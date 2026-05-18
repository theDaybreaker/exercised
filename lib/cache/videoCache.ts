import { redis } from "@/lib/redis/client";
import type { Workout } from "@/lib/schema/workout";

/**
 * VideoId cache with stampede lock (D-26a / D-26c):
 *
 * Cache key: extract:v1:{videoId}
 *   - "v1" prefix allows future invalidation by changing the version prefix
 *     without flushing the entire Redis database (T-02-02-03 mitigation).
 *
 * TTL: 30 days (2,592,000 seconds) — popular videos are rarely re-extracted.
 *
 * Stampede lock: SET NX EX 30 — atomic single-command acquire.
 *   - Returns "OK" if acquired, null if key already exists (another request holds it).
 *   - Avoids the race window between SETNX and a separate EXPIRE command.
 */

export const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000 — 30 days
export const LOCK_TTL_SECONDS = 30; // 30 seconds; lock holder must complete within this window

/** Returns the Redis cache key for a given videoId. */
export function cacheKey(videoId: string): string {
  return `extract:v1:${videoId}`;
}

/** Returns the Redis lock key for a given videoId. */
export function lockKey(videoId: string): string {
  return `lock:extract:v1:${videoId}`;
}

/**
 * Read a cached extraction result.
 * Returns null on cache miss or if the entry has expired.
 */
export async function getCached(videoId: string): Promise<Workout | null> {
  return redis.get<Workout>(cacheKey(videoId));
}

/**
 * Write a validated extraction result to cache.
 * Stores full WorkoutSchema JSON (not raw captions) — avoids re-running
 * hallucination guard on every cache hit (D-26b).
 */
export async function setCached(videoId: string, workout: Workout): Promise<void> {
  await redis.set(cacheKey(videoId), JSON.stringify(workout), {
    ex: CACHE_TTL_SECONDS,
  });
}

/**
 * Acquire a stampede lock for a videoId.
 * Returns true if this caller holds the lock; false if another request already holds it.
 *
 * The atomic SET NX EX eliminates the race window present in a SETNX + EXPIRE pair.
 * If this returns false, callers should poll getCached() for up to LOCK_TTL_SECONDS
 * to read the result when the lock holder completes.
 */
export async function acquireLock(videoId: string): Promise<boolean> {
  const result = await redis.set(lockKey(videoId), "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

/**
 * Release the stampede lock for a videoId.
 * Should be called in a finally block after setCached() to ensure the lock
 * is always released even if the extraction fails.
 */
export async function releaseLock(videoId: string): Promise<void> {
  await redis.del(lockKey(videoId));
}
