// Server emits SSE events; UI consumes events (never timers) — D-10 keeps the swap to real backend mechanical.
// Source: nextjs.org/docs/app/api-reference/file-conventions/route (Streaming section)
// Source: upstash.com/blog/sse-streaming-llm-responses
// Source: ARCHITECTURE.md Pattern 4

import { ExtractRequestSchema } from "@/lib/schema/workout";
import { getExtractionService } from "@/lib/extraction/service";
import { toSSEStream } from "@/lib/sse/stream";
import { parseYouTubeUrl, getClientIp } from "@/lib/youtube/url";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { checkSpendCap, incrementSpend } from "@/lib/spend/cap";
import { getCached, setCached, acquireLock, releaseLock } from "@/lib/cache/videoCache";
import type { ExtractEvent, Workout } from "@/lib/schema/workout";

export const runtime = "nodejs"; // Fluid Compute (default for Node since 2025-04)
export const dynamic = "force-dynamic"; // PIPE-01: required to prevent static optimization
export const maxDuration = 300; // OPS-03: 5 minutes (Hobby max with Fluid Compute)

/** All 4 SSE headers required on 200 responses — missing any causes Vercel edge buffering (Pitfall 1) */
const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no", // Critical: prevents Vercel edge buffering
};

/**
 * Async generator that yields SSE events for the extraction pipeline.
 *
 * This generator is called AFTER HTTP pre-flight checks (rate limit, spend cap).
 * It handles:
 * - Cache hit → yield result { cached: true }, no AI call
 * - Lock NOT acquired → poll getCached up to 30s for in-flight result
 * - Cache miss + lock acquired → call extraction service → incrementSpend → setCached → yield result
 */
async function* extractionStream(
  url: string,
  videoId: string,
  mode: string
): AsyncIterable<ExtractEvent> {
  // Step 5: Check cache — hit returns result without AI call or spend increment
  const cached = await getCached(videoId);
  if (cached) {
    yield { type: "result", workout: cached, cached: true };
    return;
  }

  // Step 6: Try to acquire stampede lock
  const lockAcquired = await acquireLock(videoId);

  if (!lockAcquired) {
    // Another request is already processing this videoId.
    // Poll getCached up to 30 times (1s apart) for the in-flight result.
    for (let i = 0; i < 30; i++) {
      await new Promise<void>((r) => setTimeout(r, 1000));
      const polled = await getCached(videoId);
      if (polled) {
        yield { type: "result", workout: polled, cached: true };
        return;
      }
    }
    // 30s passed without a cache entry — fall through to own extraction
    // (the lock holder may have failed; acquire a fresh lock attempt)
  }

  // Step 7: Get extraction service and iterate
  const service = await getExtractionService();
  let resultWorkout: Workout | null = null;

  try {
    for await (const event of service.extract(url)) {
      if (event.type === "result") {
        // Step 8: On result event — increment spend, cache, release lock, then yield
        resultWorkout = event.workout;
        try {
          await incrementSpend();
          await setCached(videoId, resultWorkout);
        } finally {
          if (lockAcquired) {
            await releaseLock(videoId);
          }
        }
        yield event;
      } else {
        // Yield stage and error events directly
        yield event;
      }
    }
  } catch (err) {
    // If iteration throws, release lock and re-throw (toSSEStream will handle)
    if (lockAcquired && !resultWorkout) {
      await releaseLock(videoId).catch(() => undefined);
    }
    throw err;
  }

  // If no result event was yielded (e.g., service returned only error events),
  // ensure lock is released
  if (lockAcquired && !resultWorkout) {
    await releaseLock(videoId).catch(() => undefined);
  }
}

export async function POST(req: Request) {
  // T-01-01: wrap JSON parse in try/catch to return structured 400 on malformed body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  // T-01-01: Zod-validate the request body — return 400 with issues on failure
  // T-01-06: issues is the public Zod error shape (path + code + message), no stack traces
  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const url = parsed.data.url;
  const mode = process.env.EXTRACT_MODE ?? "mock";

  // Step 1: Parse videoId — must be a valid YouTube URL
  const { videoId, isValid } = parseYouTubeUrl(url);
  if (!isValid || !videoId) {
    return Response.json({ error: "INVALID_URL", message: "Not a valid YouTube URL." }, { status: 400 });
  }

  // MOCK MODE shortcut: rate-limit keyword in URL returns HTTP 429 directly.
  // This exercises the same HTTP 429 path that ExtractFlow.tsx handles (D-13 / D-20d parity).
  if (mode === "mock" && /rate-limit/i.test(url)) {
    return new Response(
      JSON.stringify({
        error: "RATE_LIMITED",
        message: "You've extracted 5 workouts in the last hour. Try again in a bit.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "3600",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Step 2: Extract client IP for rate limiting
  const ip = getClientIp(req);

  // Step 3: Check rate limit (HTTP pre-flight — BEFORE SSE stream opens) — D-20d
  // T-02-04-01: Fail-open — if Redis is unavailable, allow the request through.
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(ip);
  } catch {
    // Redis unavailable — fail open (allow the request through)
    rateLimitResult = { limited: false };
  }

  if (rateLimitResult.limited) {
    const retryAfterSeconds =
      rateLimitResult.reset
        ? Math.max(1, Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
        : 3600;
    return new Response(
      JSON.stringify({
        error: "RATE_LIMITED",
        message: "You've extracted 5 workouts in the last hour. Try again in a bit.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Step 4: Check spend cap (HTTP pre-flight — BEFORE SSE stream opens) — D-20e
  // T-02-04-02: Fail-open — if Redis is unavailable, allow the request through.
  let underCap = true;
  try {
    underCap = await checkSpendCap();
  } catch {
    // Redis unavailable — fail open
  }

  if (!underCap) {
    return new Response(
      JSON.stringify({
        error: "BUDGET_EXHAUSTED",
        message:
          "We're popular today — try again tomorrow. (Daily extraction budget refills at midnight UTC.)",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Steps 5-11: Open SSE stream → cache check → (stampede lock) → extraction → cache write
  const stream = toSSEStream(extractionStream(url, videoId, mode));

  // Pitfall 1: ALL FOUR headers are required — missing any causes Vercel edge buffering
  return new Response(stream, { headers: SSE_HEADERS });
}
