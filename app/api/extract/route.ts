// Server emits SSE events; UI consumes events (never timers) — D-10 keeps the swap to real backend mechanical.
// Source: nextjs.org/docs/app/api-reference/file-conventions/route (Streaming section)
// Source: upstash.com/blog/sse-streaming-llm-responses
// Source: ARCHITECTURE.md Pattern 4

import { ExtractRequestSchema } from "@/lib/schema/workout";
import { getExtractionService } from "@/lib/extraction/service";
import { toSSEStream } from "@/lib/sse/stream";

export const runtime = "nodejs"; // Fluid Compute (default for Node since 2025-04)
export const dynamic = "force-dynamic"; // PIPE-01: required to prevent static optimization
export const maxDuration = 300; // OPS-03: 5 minutes (Hobby max with Fluid Compute)

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

  // Get the appropriate extraction service based on EXTRACT_MODE env var
  const service = await getExtractionService();
  const iterator = service.extract(parsed.data.url);
  const stream = toSSEStream(iterator);

  // Pitfall 1: ALL FOUR headers are required — missing any causes Vercel edge buffering
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Critical: prevents Vercel edge buffering
    },
  });
}
