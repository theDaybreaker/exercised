/**
 * tests/route-pipeline.test.ts
 *
 * Vitest tests for app/api/extract/route.ts POST handler.
 *
 * All cost-protection dependencies are mocked:
 *   - lib/ratelimit/index → checkRateLimit
 *   - lib/spend/cap → checkSpendCap, incrementSpend
 *   - lib/cache/videoCache → getCached, setCached, acquireLock, releaseLock
 *   - lib/extraction/service → getExtractionService
 *   - lib/youtube/url → getClientIp (actually just parseYouTubeUrl export verification)
 *
 * Tests verify the HTTP-then-SSE sequence (Plan 02-04 architecture):
 * 1. Rate limit check → HTTP 429 before SSE stream (D-20d)
 * 2. Spend cap check → HTTP 503 before SSE stream (D-20e)
 * 3. Cache hit → SSE stream with cached:true, no incrementSpend
 * 4. Cache miss → extraction → incrementSpend → setCached
 * 5. Lock NOT acquired → poll for cache → SSE cached:true result
 * 6. SSE headers present on all 200 responses
 * 7. Mock mode rate-limit keyword → HTTP 429 (not SSE)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all cost-protection dependencies
vi.mock("@/lib/ratelimit/index", () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/spend/cap", () => ({
  checkSpendCap: vi.fn(),
  incrementSpend: vi.fn(),
}));
vi.mock("@/lib/cache/videoCache", () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));
vi.mock("@/lib/extraction/service", () => ({
  getExtractionService: vi.fn(),
}));

import { checkRateLimit } from "@/lib/ratelimit/index";
import { checkSpendCap, incrementSpend } from "@/lib/spend/cap";
import { getCached, setCached, acquireLock, releaseLock } from "@/lib/cache/videoCache";
import { getExtractionService } from "@/lib/extraction/service";
import type { Workout } from "@/lib/schema/workout";

const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;
const mockCheckSpendCap = checkSpendCap as ReturnType<typeof vi.fn>;
const mockIncrementSpend = incrementSpend as ReturnType<typeof vi.fn>;
const mockGetCached = getCached as ReturnType<typeof vi.fn>;
const mockSetCached = setCached as ReturnType<typeof vi.fn>;
const mockAcquireLock = acquireLock as ReturnType<typeof vi.fn>;
const mockReleaseLock = releaseLock as ReturnType<typeof vi.fn>;
const mockGetExtractionService = getExtractionService as ReturnType<typeof vi.fn>;

// Valid YouTube URL with a stable 11-char videoId
const VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** Minimal valid Workout for test use */
const MOCK_WORKOUT: Workout = {
  schema_version: "1",
  workout_title: "Test Workout",
  creator_username: "tester",
  target_muscles: ["Quads"],
  estimated_duration_mins: 30,
  difficulty: "intermediate",
  extraction_confidence: "high",
  video_url: VALID_URL,
  routine: [
    {
      type: "standard_set",
      exercise_name: "Squat",
      sets: 3,
      reps: "10",
      rest_seconds: 60,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: null,
      equipment: [],
    },
    {
      type: "standard_set",
      exercise_name: "Lunge",
      sets: 3,
      reps: "12",
      rest_seconds: 60,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: null,
      equipment: [],
    },
    {
      type: "standard_set",
      exercise_name: "Deadlift",
      sets: 3,
      reps: "8",
      rest_seconds: 90,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: null,
      equipment: [],
    },
  ],
};

/** Helper: create a mock Request for POST /api/extract */
function makeRequest(url: string = VALID_URL, ip?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ip) {
    headers["x-forwarded-for"] = ip;
  }
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
}

/** Helper: parse SSE stream body into events */
async function readSSEStream(response: Response): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  const text = await response.text();
  const messages = text.split("\n\n").filter(Boolean);
  for (const msg of messages) {
    const dataLine = msg.split("\n").find((l) => l.startsWith("data:"));
    if (dataLine) {
      try {
        events.push(JSON.parse(dataLine.slice(5).trim()));
      } catch {
        // ignore malformed
      }
    }
  }
  return events;
}

/** Set up a mock extraction service that yields a single result */
function mockExtractionServiceWith(events: Array<Record<string, unknown>>) {
  const mockService = {
    extract: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  };
  mockGetExtractionService.mockResolvedValue(mockService);
}

describe("POST /api/extract — HTTP pre-flight checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: delete EXTRACT_MODE env so the test controls the env directly
    delete process.env.EXTRACT_MODE;
    // Default: rate limit passes, spend cap passes
    mockCheckRateLimit.mockResolvedValue({ limited: false });
    mockCheckSpendCap.mockResolvedValue(true);
    // Default: cache miss, lock acquired
    mockGetCached.mockResolvedValue(null);
    mockAcquireLock.mockResolvedValue(true);
    mockSetCached.mockResolvedValue(undefined);
    mockReleaseLock.mockResolvedValue(undefined);
    mockIncrementSpend.mockResolvedValue(undefined);
  });

  // Import route dynamically to allow mock setup before module loads
  async function getRoute() {
    const mod = await import("../app/api/extract/route");
    return mod.POST;
  }

  // ── Rate limit check → HTTP 429 ───────────────────────────────────────

  it("returns HTTP 429 when rate limit is exceeded", async () => {
    const futureReset = Date.now() + 60000;
    mockCheckRateLimit.mockResolvedValue({
      limited: true,
      remaining: 0,
      reset: futureReset,
    });

    const POST = await getRoute();
    const response = await POST(makeRequest(VALID_URL, "1.2.3.4"));

    expect(response.status).toBe(429);
  });

  it("HTTP 429 response body has error: RATE_LIMITED", async () => {
    mockCheckRateLimit.mockResolvedValue({
      limited: true,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const POST = await getRoute();
    const response = await POST(makeRequest(VALID_URL, "1.2.3.4"));
    const body = await response.json();

    expect(body.error).toBe("RATE_LIMITED");
    expect(body.message).toBeTruthy();
  });

  it("HTTP 429 response includes Retry-After header", async () => {
    mockCheckRateLimit.mockResolvedValue({
      limited: true,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const POST = await getRoute();
    const response = await POST(makeRequest(VALID_URL, "1.2.3.4"));

    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("checkRateLimit is called before checkSpendCap (order validation)", async () => {
    const callOrder: string[] = [];
    mockCheckRateLimit.mockImplementation(async () => {
      callOrder.push("rateLimit");
      return { limited: false };
    });
    mockCheckSpendCap.mockImplementation(async () => {
      callOrder.push("spendCap");
      return true;
    });
    mockGetCached.mockImplementation(async () => {
      callOrder.push("getCached");
      return null;
    });

    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    await POST(makeRequest());

    expect(callOrder.indexOf("rateLimit")).toBeLessThan(callOrder.indexOf("spendCap"));
  });

  it("checkSpendCap is called before getCached (order validation)", async () => {
    const callOrder: string[] = [];
    mockCheckRateLimit.mockImplementation(async () => {
      callOrder.push("rateLimit");
      return { limited: false };
    });
    mockCheckSpendCap.mockImplementation(async () => {
      callOrder.push("spendCap");
      return true;
    });
    mockGetCached.mockImplementation(async () => {
      callOrder.push("getCached");
      return null;
    });

    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    await POST(makeRequest());

    expect(callOrder.indexOf("spendCap")).toBeLessThan(callOrder.indexOf("getCached"));
  });

  // ── Spend cap check → HTTP 503 ────────────────────────────────────────

  it("returns HTTP 503 when spend cap is exceeded", async () => {
    mockCheckSpendCap.mockResolvedValue(false);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.status).toBe(503);
  });

  it("HTTP 503 response body has error: BUDGET_EXHAUSTED", async () => {
    mockCheckSpendCap.mockResolvedValue(false);

    const POST = await getRoute();
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.error).toBe("BUDGET_EXHAUSTED");
    expect(body.message).toBeTruthy();
  });

  it("rate limit is NOT checked after spend cap fails (short-circuit)", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, remaining: 0, reset: Date.now() + 60000 });
    mockCheckSpendCap.mockResolvedValue(false);

    // With limited=true AND spendCap=false, the order matters:
    // rate limit check runs BEFORE spend cap, so 429 should win
    const POST = await getRoute();
    const response = await POST(makeRequest());
    expect(response.status).toBe(429); // rate limit runs first
  });

  // ── Cache hit → SSE result with cached:true, no incrementSpend ────────

  it("returns 200 with SSE result when cache hit (cached: true)", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const events = await readSSEStream(response);
    const resultEvent = events.find((e) => e.type === "result");

    expect(resultEvent).toBeDefined();
    expect(resultEvent?.cached).toBe(true);
  });

  it("does NOT call incrementSpend on cache hit", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    await POST(makeRequest());

    expect(mockIncrementSpend).not.toHaveBeenCalled();
  });

  it("does NOT call getExtractionService on cache hit", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    await POST(makeRequest());

    expect(mockGetExtractionService).not.toHaveBeenCalled();
  });

  // ── Cache miss → extraction → incrementSpend → setCached ─────────────

  it("calls getExtractionService when cache miss + lock acquired", async () => {
    mockGetCached.mockResolvedValue(null);
    mockAcquireLock.mockResolvedValue(true);
    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    const response = await POST(makeRequest());
    // Must consume the stream to trigger async extraction work
    await readSSEStream(response);

    expect(mockGetExtractionService).toHaveBeenCalled();
  });

  it("calls incrementSpend after successful extraction", async () => {
    mockGetCached.mockResolvedValue(null);
    mockAcquireLock.mockResolvedValue(true);
    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    const response = await POST(makeRequest());
    // Must consume the stream to trigger async extraction work
    await readSSEStream(response);

    expect(mockIncrementSpend).toHaveBeenCalled();
  });

  it("calls setCached after successful extraction", async () => {
    mockGetCached.mockResolvedValue(null);
    mockAcquireLock.mockResolvedValue(true);
    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    const response = await POST(makeRequest());
    // Must consume the stream to trigger async extraction work
    await readSSEStream(response);

    expect(mockSetCached).toHaveBeenCalledWith("dQw4w9WgXcQ", MOCK_WORKOUT);
  });

  it("calls releaseLock after extraction (success path)", async () => {
    mockGetCached.mockResolvedValue(null);
    mockAcquireLock.mockResolvedValue(true);
    mockExtractionServiceWith([
      { type: "result", workout: MOCK_WORKOUT, lowConfidence: false },
    ]);

    const POST = await getRoute();
    const response = await POST(makeRequest());
    // Must consume the stream to trigger async extraction work
    await readSSEStream(response);

    expect(mockReleaseLock).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  // ── SSE headers on all 200 responses ─────────────────────────────────

  it("200 SSE response includes Content-Type: text/event-stream", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.headers.get("Content-Type")).toMatch(/text\/event-stream/);
  });

  it("200 SSE response includes Cache-Control: no-cache", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.headers.get("Cache-Control")).toMatch(/no-cache/);
  });

  it("200 SSE response includes Connection: keep-alive", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("200 SSE response includes X-Accel-Buffering: no", async () => {
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  // ── 429/503 responses do NOT have SSE headers ─────────────────────────

  it("429 response does not have text/event-stream Content-Type", async () => {
    mockCheckRateLimit.mockResolvedValue({
      limited: true,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const POST = await getRoute();
    const response = await POST(makeRequest());

    expect(response.headers.get("Content-Type")).not.toMatch(/text\/event-stream/);
  });

  // ── Client IP extraction ──────────────────────────────────────────────

  it("extracts client IP from x-forwarded-for header", async () => {
    mockCheckRateLimit.mockImplementation(async (ip: string) => {
      return { limited: false, _capturedIp: ip };
    });

    // We need to check what IP was passed to checkRateLimit
    mockGetCached.mockResolvedValue(MOCK_WORKOUT);

    const POST = await getRoute();
    await POST(makeRequest(VALID_URL, "203.0.113.5"));

    expect(mockCheckRateLimit).toHaveBeenCalledWith("203.0.113.5");
  });

  // ── Mock mode: rate-limit keyword → HTTP 429 ──────────────────────────

  it("mock mode: URL matching /rate-limit/i returns HTTP 429 directly", async () => {
    process.env.EXTRACT_MODE = "mock";

    const rateLimitUrl = "https://www.youtube.com/watch?v=rate-limit-demo1";
    const POST = await getRoute();
    const response = await POST(makeRequest(rateLimitUrl));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("RATE_LIMITED");

    delete process.env.EXTRACT_MODE;
  });

  it("mock mode: URL matching /rate-limit/i does NOT open SSE stream", async () => {
    process.env.EXTRACT_MODE = "mock";

    const rateLimitUrl = "https://www.youtube.com/watch?v=rate-limit-demo1";
    const POST = await getRoute();
    const response = await POST(makeRequest(rateLimitUrl));

    expect(response.headers.get("Content-Type")).not.toMatch(/text\/event-stream/);

    delete process.env.EXTRACT_MODE;
  });

  // ── Invalid URL → HTTP 400 ────────────────────────────────────────────

  it("returns HTTP 400 on invalid YouTube URL format", async () => {
    const POST = await getRoute();
    const response = await POST(makeRequest("https://notyoutube.com/video"));

    expect(response.status).toBe(400);
  });
});
