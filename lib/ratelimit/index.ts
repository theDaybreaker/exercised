import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis/client";

/**
 * Two-ratelimiter pattern (D-20a + D-20b):
 * - hourlyLimiter: 5 extractions per IP per hour (primary throttle)
 * - dailyLimiter: 20 extractions per IP per 24h (backstop against pacing abuse)
 *
 * Both limiters share the same Redis singleton.
 * Separate prefixes keep the key namespaces independent.
 * analytics: true enables Upstash's request analytics dashboard.
 */
export const hourlyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "rl:hourly",
  analytics: true,
});

export const dailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "24 h"),
  prefix: "rl:daily",
  analytics: true,
});

export interface RateLimitResult {
  limited: boolean;
  remaining?: number;
  reset?: number;
}

/**
 * Check both rate limiters sequentially.
 * Returns on the first failure (hourly or daily); does not call the second limiter
 * if the first already fails — avoids consuming daily quota on already-throttled IPs.
 *
 * Fail-open: if Redis is unavailable, an exception from limit() will propagate
 * to the caller. Route handlers should catch and allow the request through (T-02-02-02).
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const hourly = await hourlyLimiter.limit(ip);
  if (!hourly.success) {
    return {
      limited: true,
      remaining: hourly.remaining,
      reset: hourly.reset,
    };
  }

  const daily = await dailyLimiter.limit(ip);
  if (!daily.success) {
    return {
      limited: true,
      remaining: daily.remaining,
      reset: daily.reset,
    };
  }

  return { limited: false };
}
