import { redis } from "@/lib/redis/client";

/**
 * Global daily spend cap (D-20c):
 * Tracks extraction count via Redis INCR; resets at midnight UTC.
 *
 * Key design: count extractions (not dollars) for simplicity.
 * $0.02 avg × 250 = $5 target. Tunable via DAILY_EXTRACTION_CAP env var.
 *
 * TTL is set to secondsUntilMidnightUTC() + 3600 (one hour buffer for clock skew)
 * to prevent boundary-condition edge cases where the key expires mid-day.
 */

/** Returns today's Redis key in "spend:daily:YYYY-MM-DD" format (UTC date). */
export function getDailySpendKey(): string {
  const date = new Date().toISOString().slice(0, 10); // "2026-05-17"
  return `spend:daily:${date}`;
}

/** Returns the number of seconds remaining until midnight UTC. */
export function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0); // next midnight UTC
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Returns true if the current daily spend is under the configured cap.
 * Returns false when the cap is reached or exceeded — callers should
 * emit BUDGET_EXHAUSTED and refuse to proceed with the extraction.
 */
export async function checkSpendCap(): Promise<boolean> {
  const cap = parseInt(process.env.DAILY_EXTRACTION_CAP ?? "250", 10);
  const key = getDailySpendKey();
  const current = (await redis.get<number>(key)) ?? 0;
  return current < cap;
}

/**
 * Atomically increment the daily extraction counter.
 * On the first increment of the day (count === 1), sets a TTL that expires
 * the key just after midnight UTC with a 1-hour buffer for clock skew.
 *
 * Anti-pattern avoided: do NOT call redis.expire() on every increment —
 * that risks resetting the TTL on every request (Pitfall 4).
 */
export async function incrementSpend(): Promise<void> {
  const key = getDailySpendKey();
  const count = await redis.incr(key);
  if (count === 1) {
    // Set TTL on first increment only — subsequent increments preserve the TTL.
    // Extra 3600s buffer handles clock skew between app servers and Redis.
    await redis.expire(key, secondsUntilMidnightUTC() + 3600);
  }
}
