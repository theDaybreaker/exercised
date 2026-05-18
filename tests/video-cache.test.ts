/**
 * Unit tests for lib/cache/videoCache.ts
 *
 * Redis is mocked — no real network calls.
 * Tests verify:
 *  - getCached("abc123") returns null or Workout
 *  - setCached("abc123", workout) resolves without throw
 *  - acquireLock("abc123") returns boolean
 *  - releaseLock("abc123") resolves without throw
 *  - cacheKey("abc123") === "extract:v1:abc123"
 *  - lockKey("abc123") === "lock:extract:v1:abc123"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Workout } from "@/lib/schema/workout";

// Minimal valid Workout fixture for tests
const SAMPLE_WORKOUT: Workout = {
  schema_version: "1",
  workout_title: "Test Workout",
  creator_username: "testcreator",
  target_muscles: ["chest"],
  estimated_duration_mins: 30,
  difficulty: "intermediate",
  extraction_confidence: "high",
  video_url: null,
  routine: [
    {
      type: "standard_set",
      exercise_name: "Push-Up",
      sets: 3,
      reps: "10",
      rest_seconds: 60,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: null,
      equipment: [],
    },
  ],
};

// Mock Redis before importing module under test
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: mockGet,
    set: mockSet,
    del: mockDel,
  },
}));

describe("lib/cache/videoCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("key helpers", () => {
    it("cacheKey returns 'extract:v1:{videoId}'", async () => {
      const { cacheKey } = await import("@/lib/cache/videoCache");
      expect(cacheKey("abc123")).toBe("extract:v1:abc123");
    });

    it("lockKey returns 'lock:extract:v1:{videoId}'", async () => {
      const { lockKey } = await import("@/lib/cache/videoCache");
      expect(lockKey("abc123")).toBe("lock:extract:v1:abc123");
    });

    it("cacheKey includes the v1 version prefix for future invalidation", async () => {
      const { cacheKey } = await import("@/lib/cache/videoCache");
      expect(cacheKey("dQw4w9WgXcQ")).toBe("extract:v1:dQw4w9WgXcQ");
    });
  });

  describe("getCached", () => {
    it("returns null when cache miss", async () => {
      mockGet.mockResolvedValue(null);
      const { getCached } = await import("@/lib/cache/videoCache");
      const result = await getCached("abc123");
      expect(result).toBeNull();
    });

    it("returns Workout object on cache hit", async () => {
      mockGet.mockResolvedValue(SAMPLE_WORKOUT);
      const { getCached } = await import("@/lib/cache/videoCache");
      const result = await getCached("abc123");
      expect(result).toEqual(SAMPLE_WORKOUT);
    });

    it("calls redis.get with the correct cache key", async () => {
      mockGet.mockResolvedValue(null);
      const { getCached } = await import("@/lib/cache/videoCache");
      await getCached("myVideoId");
      expect(mockGet).toHaveBeenCalledWith("extract:v1:myVideoId");
    });
  });

  describe("setCached", () => {
    it("resolves without throw", async () => {
      mockSet.mockResolvedValue("OK");
      const { setCached } = await import("@/lib/cache/videoCache");
      await expect(setCached("abc123", SAMPLE_WORKOUT)).resolves.toBeUndefined();
    });

    it("calls redis.set with the correct key, JSON stringified value, and 30-day TTL", async () => {
      mockSet.mockResolvedValue("OK");
      const { setCached } = await import("@/lib/cache/videoCache");
      await setCached("abc123", SAMPLE_WORKOUT);
      expect(mockSet).toHaveBeenCalledWith(
        "extract:v1:abc123",
        JSON.stringify(SAMPLE_WORKOUT),
        { ex: 30 * 24 * 60 * 60 }, // 2592000 seconds = 30 days
      );
    });

    it("uses CACHE_TTL_SECONDS of 2592000 (30 days)", async () => {
      mockSet.mockResolvedValue("OK");
      const { setCached } = await import("@/lib/cache/videoCache");
      await setCached("abc123", SAMPLE_WORKOUT);
      const callArgs = mockSet.mock.calls[0];
      expect(callArgs[2].ex).toBe(2592000);
    });
  });

  describe("acquireLock", () => {
    it("returns true when lock is acquired (Redis returns 'OK')", async () => {
      mockSet.mockResolvedValue("OK");
      const { acquireLock } = await import("@/lib/cache/videoCache");
      const result = await acquireLock("abc123");
      expect(result).toBe(true);
    });

    it("returns false when lock is already held (Redis returns null)", async () => {
      mockSet.mockResolvedValue(null);
      const { acquireLock } = await import("@/lib/cache/videoCache");
      const result = await acquireLock("abc123");
      expect(result).toBe(false);
    });

    it("calls redis.set with NX and EX options on the lock key", async () => {
      mockSet.mockResolvedValue("OK");
      const { acquireLock } = await import("@/lib/cache/videoCache");
      await acquireLock("abc123");
      expect(mockSet).toHaveBeenCalledWith(
        "lock:extract:v1:abc123",
        "1",
        { nx: true, ex: 30 }, // LOCK_TTL_SECONDS = 30
      );
    });
  });

  describe("releaseLock", () => {
    it("resolves without throw", async () => {
      mockDel.mockResolvedValue(1);
      const { releaseLock } = await import("@/lib/cache/videoCache");
      await expect(releaseLock("abc123")).resolves.toBeUndefined();
    });

    it("calls redis.del with the correct lock key", async () => {
      mockDel.mockResolvedValue(1);
      const { releaseLock } = await import("@/lib/cache/videoCache");
      await releaseLock("abc123");
      expect(mockDel).toHaveBeenCalledWith("lock:extract:v1:abc123");
    });
  });
});
