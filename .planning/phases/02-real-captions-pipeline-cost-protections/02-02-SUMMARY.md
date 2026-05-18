---
phase: 02-real-captions-pipeline-cost-protections
plan: 02
subsystem: cost-protection-infrastructure
tags: [redis, ratelimit, cache, spend-cap, upstash, tdd, gemini]
dependency_graph:
  requires: [02-01-SUMMARY.md]
  provides: [lib/redis/client.ts, lib/ratelimit/index.ts, lib/spend/cap.ts, lib/cache/videoCache.ts]
  affects: [app/api/extract/route.ts (consumed in 02-04), .env.example]
tech_stack:
  added:
    - ai@6.0.184
    - "@ai-sdk/google@3.0.75 (Gemini swap — replaces @ai-sdk/openai from plan)"
    - "@upstash/redis@1.38.0"
    - "@upstash/ratelimit@2.0.8"
    - youtube-caption-extractor@1.10.2
    - youtube-transcript@1.3.1
    - resend@6.12.3
  patterns:
    - Redis singleton via Redis.fromEnv() with KV_* alias fallback
    - Two-ratelimiter pattern (separate hourly + daily Ratelimit instances with separate prefixes)
    - Redis INCR + EXPIRE for daily spend counter (TTL set only on count===1)
    - SET NX EX for atomic stampede lock (single Redis command, no race window)
    - extract:v1: versioned cache key prefix for future invalidation without full flush
key_files:
  created:
    - lib/redis/client.ts
    - lib/ratelimit/index.ts
    - lib/spend/cap.ts
    - lib/cache/videoCache.ts
    - tests/ratelimit.test.ts
    - tests/spend-cap.test.ts
    - tests/video-cache.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - .env.example
    - .gitignore
decisions:
  - "User selected Gemini 2.5 Flash (@ai-sdk/google) over GPT-4o (@ai-sdk/openai) for free tier cost reduction; openai package not installed"
  - "GOOGLE_GENERATIVE_AI_API_KEY added to .env.example instead of OPENAI_API_KEY"
  - "Redis.fromEnv() with explicit KV_* alias fallback to handle both Vercel KV and Upstash naming conventions"
  - "getDailySpendKey() and secondsUntilMidnightUTC() exported from cap.ts for direct testability"
  - "CACHE_TTL_SECONDS and LOCK_TTL_SECONDS exported as named constants for consumer readability"
  - "cacheKey() and lockKey() exported as named functions for direct testability in unit tests"
metrics:
  duration_mins: 25
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_changed: 11
---

# Phase 2 Plan 02: Redis Infrastructure (Rate Limit + Spend Cap + Cache) Summary

**One-liner:** Installed 7 Phase 2 packages (Gemini swap), created a shared Redis singleton, and implemented three Redis-backed cost-protection modules (rate limiter, spend cap, videoId cache with stampede lock) — all with mocked unit tests.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install packages + Redis singleton | 84c6bed | package.json, pnpm-lock.yaml, lib/redis/client.ts, .env.example |
| 2 (RED+GREEN) | Rate limiter + spend cap + cache modules | 076df8e | lib/ratelimit/index.ts, lib/spend/cap.ts, lib/cache/videoCache.ts, 3 test files |

## What Was Built

### Package Installation

7 packages installed via `pnpm add ai @ai-sdk/google @upstash/redis @upstash/ratelimit youtube-caption-extractor youtube-transcript resend`. The user selected Gemini 2.5 Flash (`@ai-sdk/google`) instead of GPT-4o (`@ai-sdk/openai`) for the LLM provider — the plan was updated accordingly; `openai` package was not installed.

### Redis Singleton (`lib/redis/client.ts`)

Singleton Redis instance via `Redis.fromEnv()`. A try/catch fallback handles edge cases where the installed `@upstash/redis` version doesn't resolve both the `KV_REST_API_URL` (Vercel KV product naming) and `UPSTASH_REDIS_REST_URL` (Upstash console naming) simultaneously. The fallback reads both naming conventions explicitly, so the module works in all environments. An explanatory comment documents the aliasing.

### Rate Limiter (`lib/ratelimit/index.ts`)

Two-ratelimiter pattern (D-20a + D-20b):
- `hourlyLimiter`: `Ratelimit.slidingWindow(5, "1 h")`, prefix `"rl:hourly"`, `analytics: true`
- `dailyLimiter`: `Ratelimit.slidingWindow(20, "24 h")`, prefix `"rl:daily"`, `analytics: true`
- `checkRateLimit(ip)`: checks hourly first (fail-fast), then daily; returns `{ limited: boolean; remaining?: number; reset?: number }`
- Fail-open pattern: if Redis is unavailable, exceptions propagate to the route handler which should catch and allow through (T-02-02-02 threat mitigation documentation)

### Spend Cap (`lib/spend/cap.ts`)

Global daily extraction counter (D-20c):
- `getDailySpendKey()`: returns `"spend:daily:YYYY-MM-DD"` using UTC date
- `secondsUntilMidnightUTC()`: computes TTL to midnight UTC with `Math.ceil`
- `checkSpendCap()`: reads `DAILY_EXTRACTION_CAP` env var (default 250), returns `current < cap`
- `incrementSpend()`: `redis.incr(key)`, sets TTL only when `count === 1` (avoids Pitfall 4 — TTL reset on every increment)
- TTL includes 3600-second buffer beyond midnight for clock skew tolerance

### VideoId Cache (`lib/cache/videoCache.ts`)

Cache with stampede lock (D-26a + D-26c):
- `cacheKey(videoId)`: `"extract:v1:${videoId}"` — versioned prefix (T-02-02-03 mitigation)
- `lockKey(videoId)`: `"lock:extract:v1:${videoId}"`
- `CACHE_TTL_SECONDS = 2592000` (30 days)
- `LOCK_TTL_SECONDS = 30`
- `getCached()`: `redis.get<Workout>(cacheKey)`
- `setCached()`: `redis.set(key, JSON.stringify(workout), { ex: CACHE_TTL_SECONDS })` — stores full validated WorkoutSchema (D-26b)
- `acquireLock()`: `redis.set(key, "1", { nx: true, ex: LOCK_TTL_SECONDS })` — atomic single-command acquire, returns `result === "OK"`
- `releaseLock()`: `redis.del(lockKey)`

### Test Coverage (TDD RED → GREEN)

31 new unit tests across 3 files with mocked Redis:
- `tests/ratelimit.test.ts`: 8 tests — exports, constructor args (prefix, analytics, slidingWindow params), checkRateLimit return shapes
- `tests/spend-cap.test.ts`: 9 tests — cap under/at/over, null handling, default 250, incrementSpend TTL behavior, key format
- `tests/video-cache.test.ts`: 14 tests — key helpers, getCached miss/hit/key-correctness, setCached args/TTL, acquireLock OK/null/args, releaseLock resolves/key

Total test suite: 129 tests across 14 files — all pass.

### Environment Variables

`.env.example` expanded with:
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (with Vercel KV alias documentation)
- `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini — replaces OPENAI_API_KEY per user preference)
- `DAILY_EXTRACTION_CAP=250`
- `RESEND_API_KEY`, `ALERT_EMAIL`, `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPO`

## Deviations from Plan

### User-Driven Provider Swap

**[User Decision] OpenAI → Gemini provider**
- **Specified in objective:** User picked Gemini 2.5 Flash over GPT-4o for free tier access
- **Change:** `@ai-sdk/google` installed instead of `@ai-sdk/openai`; `openai` package not installed
- **Impact:** `.env.example` uses `GOOGLE_GENERATIVE_AI_API_KEY` instead of `OPENAI_API_KEY`; Plan 02-03 will use `@ai-sdk/google` when implementing `callLLM()`
- **Files modified:** package.json, pnpm-lock.yaml, .env.example

### Helper Functions Exported for Testability

**[Rule 2 - Missing critical functionality] `getDailySpendKey` and key helper functions exported**
- **Found during:** Task 2 TDD implementation
- **Issue:** The plan specified `getDailySpendKey()` as testable (test verifies key format) but the original pattern in RESEARCH.md had it as a private helper
- **Fix:** Exported `getDailySpendKey()`, `secondsUntilMidnightUTC()`, `cacheKey()`, `lockKey()` — these are functional helpers that belong as named exports for unit testability per the plan's test spec
- **Files modified:** lib/spend/cap.ts, lib/cache/videoCache.ts

### TypeScript Type Fix in Test File

**[Rule 1 - Bug] Ratelimit test TypeScript type error on mock.calls destructuring**
- **Found during:** Task 2 typecheck
- **Issue:** `slidingWindow.mock.calls` is typed as `any[][]` — destructuring as `[number, string]` in `.some()` predicate caused TS2345 type error
- **Fix:** Cast mock.calls to `Array<[number, string]>` before `.some()`
- **Files modified:** tests/ratelimit.test.ts

## Verification Results

```
pnpm test --run: 14 test files, 129 tests — ALL PASSED
pnpm typecheck: exits 0 (no errors)
lib/ratelimit/index.ts: contains Ratelimit.slidingWindow(5, "1 h") — FOUND
lib/ratelimit/index.ts: contains Ratelimit.slidingWindow(20, "24 h") — FOUND
lib/ratelimit/index.ts: prefix "rl:hourly" and "rl:daily" — FOUND
lib/spend/cap.ts: contains redis.incr — FOUND
lib/cache/videoCache.ts: contains "extract:v1:" (3 occurrences) — FOUND
lib/cache/videoCache.ts: CACHE_TTL_SECONDS = 30 * 24 * 60 * 60 — FOUND
lib/cache/videoCache.ts: LOCK_TTL_SECONDS = 30 — FOUND
.env.example: GOOGLE_GENERATIVE_AI_API_KEY — FOUND
.env.example: UPSTASH_REDIS_REST_URL — FOUND
```

## Known Stubs

None — all modules implement their full interface. No placeholder returns, no hardcoded empty values that flow to UI. The Redis client will fail at runtime (not module load) if credentials are absent, which is the correct behavior for a server-side infrastructure module.

## Threat Flags

No new security surface introduced beyond what was in the plan's threat model. T-02-02-02 (Redis outage fail-open) is documented in `checkRateLimit` via a code comment — callers must implement try/catch to achieve fail-open in practice. T-02-02-03 (cache key versioning) is implemented via the `extract:v1:` prefix.

## Self-Check: PASSED

- lib/redis/client.ts: FOUND
- lib/ratelimit/index.ts: FOUND
- lib/spend/cap.ts: FOUND
- lib/cache/videoCache.ts: FOUND
- tests/ratelimit.test.ts: FOUND
- tests/spend-cap.test.ts: FOUND
- tests/video-cache.test.ts: FOUND
- Commits 84c6bed, 076df8e: FOUND in git log
