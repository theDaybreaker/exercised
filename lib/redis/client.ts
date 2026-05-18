import { Redis } from "@upstash/redis";

/**
 * Shared Redis singleton for rate limiting, cache, and spend cap.
 *
 * Do NOT instantiate Redis elsewhere — use this export everywhere.
 *
 * Environment variable aliasing note:
 * Vercel's built-in KV product injects KV_REST_API_URL and KV_REST_API_TOKEN.
 * Upstash's own console uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * The @upstash/redis package's Redis.fromEnv() reads both naming conventions natively.
 * If for any reason fromEnv() does not resolve the variables in the installed version,
 * the explicit fallback below covers both: Vercel KV_* aliases and Upstash UPSTASH_* names.
 */
export const redis: Redis = (() => {
  // Prefer fromEnv() which reads both KV_REST_API_URL and UPSTASH_REDIS_REST_URL natively.
  // In environments where neither set is available (local dev without .env.local),
  // the Redis calls will fail at runtime — not at module load — which is the correct behavior.
  try {
    return Redis.fromEnv();
  } catch {
    // Explicit fallback: try both Vercel KV_* naming and Upstash UPSTASH_* naming.
    // This handles edge cases where Redis.fromEnv() is picky about exact variable names.
    const url =
      process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis configuration missing. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN " +
          "or KV_REST_API_URL + KV_REST_API_TOKEN in your environment.",
      );
    }
    return new Redis({ url, token });
  }
})();
