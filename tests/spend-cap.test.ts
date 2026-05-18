/**
 * Unit tests for lib/spend/cap.ts
 *
 * Redis is mocked — no real network calls.
 * Tests verify:
 *  - checkSpendCap() returns boolean
 *  - incrementSpend() resolves without throw
 *  - getDailySpendKey() returns a string in format "spend:daily:YYYY-MM-DD"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing module under test
const mockGet = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();

vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: mockGet,
    incr: mockIncr,
    expire: mockExpire,
  },
}));

describe("lib/spend/cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("checkSpendCap returns true when current spend is under cap", async () => {
    mockGet.mockResolvedValue(10);
    const { checkSpendCap } = await import("@/lib/spend/cap");
    const result = await checkSpendCap();
    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });

  it("checkSpendCap returns false when current spend equals cap", async () => {
    vi.stubEnv("DAILY_EXTRACTION_CAP", "50");
    mockGet.mockResolvedValue(50);
    const { checkSpendCap } = await import("@/lib/spend/cap");
    const result = await checkSpendCap();
    expect(result).toBe(false);
  });

  it("checkSpendCap returns false when current spend exceeds cap", async () => {
    vi.stubEnv("DAILY_EXTRACTION_CAP", "50");
    mockGet.mockResolvedValue(99);
    const { checkSpendCap } = await import("@/lib/spend/cap");
    const result = await checkSpendCap();
    expect(result).toBe(false);
  });

  it("checkSpendCap defaults to cap of 250 when env var is missing", async () => {
    // No DAILY_EXTRACTION_CAP set — should default to 250
    mockGet.mockResolvedValue(100);
    const { checkSpendCap } = await import("@/lib/spend/cap");
    const result = await checkSpendCap();
    expect(result).toBe(true); // 100 < 250
  });

  it("checkSpendCap handles null Redis value as 0", async () => {
    mockGet.mockResolvedValue(null);
    const { checkSpendCap } = await import("@/lib/spend/cap");
    const result = await checkSpendCap();
    expect(result).toBe(true); // 0 < 250
  });

  it("incrementSpend resolves without throw on first call (count === 1 triggers expire)", async () => {
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
    const { incrementSpend } = await import("@/lib/spend/cap");
    await expect(incrementSpend()).resolves.toBeUndefined();
    expect(mockIncr).toHaveBeenCalledTimes(1);
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });

  it("incrementSpend does NOT call expire on subsequent increments (count > 1)", async () => {
    mockIncr.mockResolvedValue(5); // not first increment
    const { incrementSpend } = await import("@/lib/spend/cap");
    await incrementSpend();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it("getDailySpendKey returns string in 'spend:daily:YYYY-MM-DD' format", async () => {
    const { getDailySpendKey } = await import("@/lib/spend/cap");
    const key = getDailySpendKey();
    expect(key).toMatch(/^spend:daily:\d{4}-\d{2}-\d{2}$/);
  });

  it("getDailySpendKey contains today's UTC date", async () => {
    const { getDailySpendKey } = await import("@/lib/spend/cap");
    const key = getDailySpendKey();
    const expectedDate = new Date().toISOString().slice(0, 10);
    expect(key).toBe(`spend:daily:${expectedDate}`);
  });
});
