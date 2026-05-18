/**
 * Unit tests for lib/ratelimit/index.ts
 *
 * Redis and Ratelimit are mocked — no real network calls.
 * Tests verify:
 *  - hourlyLimiter is a Ratelimit instance with slidingWindow(5, "1 h") and prefix "rl:hourly"
 *  - dailyLimiter is a Ratelimit instance with slidingWindow(20, "24 h") and prefix "rl:daily"
 *  - checkRateLimit("127.0.0.1") returns { limited: boolean } shape
 *  - checkRateLimit is exported from lib/ratelimit/index.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @upstash/redis before importing the module under test
vi.mock("@upstash/redis", () => {
  const RedisMock = vi.fn().mockImplementation(() => ({}));
  (RedisMock as typeof RedisMock & { fromEnv: typeof vi.fn }).fromEnv = vi
    .fn()
    .mockReturnValue({});
  return { Redis: RedisMock };
});

// Mock @upstash/ratelimit to capture constructor args and control limit() behavior
const mockLimit = vi.fn();
const mockRatelimitConstructor = vi.fn().mockImplementation(function (
  this: { limit: typeof mockLimit },
) {
  this.limit = mockLimit;
});
(
  mockRatelimitConstructor as typeof mockRatelimitConstructor & {
    slidingWindow: typeof vi.fn;
  }
).slidingWindow = vi
  .fn()
  .mockImplementation((count: number, window: string) => ({ count, window }));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: mockRatelimitConstructor,
}));

// Also mock lib/redis/client to return our mock redis
vi.mock("@/lib/redis/client", () => ({
  redis: {},
}));

describe("lib/ratelimit/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module to re-run module-level setup each time
    vi.resetModules();
  });

  it("exports checkRateLimit function", async () => {
    const mod = await import("@/lib/ratelimit/index");
    expect(typeof mod.checkRateLimit).toBe("function");
  });

  it("exports hourlyLimiter", async () => {
    const mod = await import("@/lib/ratelimit/index");
    expect(mod.hourlyLimiter).toBeDefined();
  });

  it("exports dailyLimiter", async () => {
    const mod = await import("@/lib/ratelimit/index");
    expect(mod.dailyLimiter).toBeDefined();
  });

  it("creates hourlyLimiter with slidingWindow(5, '1 h') and prefix 'rl:hourly'", async () => {
    await import("@/lib/ratelimit/index");
    // First call is for hourlyLimiter
    const firstCall = mockRatelimitConstructor.mock.calls[0][0];
    expect(firstCall.prefix).toBe("rl:hourly");
    expect(firstCall.analytics).toBe(true);
    // slidingWindow was called with 5 and "1 h" for hourly
    const slidingWindowCalls = (
      mockRatelimitConstructor as typeof mockRatelimitConstructor & {
        slidingWindow: ReturnType<typeof vi.fn>;
      }
    ).slidingWindow.mock.calls as Array<[number, string]>;
    expect(slidingWindowCalls.some(([c, w]) => c === 5 && w === "1 h")).toBe(
      true,
    );
  });

  it("creates dailyLimiter with slidingWindow(20, '24 h') and prefix 'rl:daily'", async () => {
    await import("@/lib/ratelimit/index");
    // Second call is for dailyLimiter
    const secondCall = mockRatelimitConstructor.mock.calls[1][0];
    expect(secondCall.prefix).toBe("rl:daily");
    expect(secondCall.analytics).toBe(true);
    const slidingWindowCalls = (
      mockRatelimitConstructor as typeof mockRatelimitConstructor & {
        slidingWindow: ReturnType<typeof vi.fn>;
      }
    ).slidingWindow.mock.calls as Array<[number, string]>;
    expect(slidingWindowCalls.some(([c, w]) => c === 20 && w === "24 h")).toBe(
      true,
    );
  });

  it("checkRateLimit returns { limited: false } when both limiters pass", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 4, reset: 0 });
    const mod = await import("@/lib/ratelimit/index");
    const result = await mod.checkRateLimit("127.0.0.1");
    expect(result.limited).toBe(false);
  });

  it("checkRateLimit returns { limited: true } when hourly limit fails", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 1234 });
    const mod = await import("@/lib/ratelimit/index");
    const result = await mod.checkRateLimit("127.0.0.1");
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("checkRateLimit returns { limited: true } when daily limit fails", async () => {
    // hourly passes, daily fails
    mockLimit
      .mockResolvedValueOnce({ success: true, remaining: 3, reset: 0 })
      .mockResolvedValueOnce({ success: false, remaining: 0, reset: 9999 });
    const mod = await import("@/lib/ratelimit/index");
    const result = await mod.checkRateLimit("127.0.0.1");
    expect(result.limited).toBe(true);
    expect(result.reset).toBe(9999);
  });
});
