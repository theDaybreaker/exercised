# Phase 2: Real Captions Pipeline + Cost Protections - Research

**Researched:** 2026-05-17
**Domain:** YouTube caption extraction, Vercel AI SDK structured generation, Upstash Redis rate limiting and caching, Vercel Cron, cost protection patterns
**Confidence:** HIGH (core stack), MEDIUM (caption library failure modes, OpenAI structured outputs specifics)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-20: Rate-Limit + Daily Spend Cap**
- D-20a: Per-IP sliding window = 5 extractions / 1 hour via `@upstash/ratelimit` sliding-window
- D-20b: Per-IP daily cap = 20 / 24h as backstop
- D-20c: Global daily spend cap = $5/day initial (~250 extractions); tunable via Redis config key without redeploy
- D-20d: Rate-limit response = HTTP 429 + `Retry-After` + `X-RateLimit-Remaining` headers + `{ error: "RATE_LIMITED", message }` JSON body; existing `RATE_LIMITED` `ErrorState` variant
- D-20e: Spend-cap response = new `BUDGET_EXHAUSTED` SSE error code (additive); copy: "We're popular today — try again tomorrow. (Daily extraction budget refills at midnight UTC.)"
- D-20f: Share-link reads (`?w=`) never hit `/api/extract` — stay free

**D-21: Eval-Set Composition + Ship Gate**
- 9 videos: 8 fitness + 1 non-fitness control
- Binary pass criteria: 100% valid WorkoutSchema, 100% sourceQuote substring match, ≥80% exercise recall, non-fitness → NO_WORKOUT
- Rubric criteria: sets/reps/rest accuracy (1-5), difficulty plausibility (1-5) — tracked, not blocking
- Lives at `tests/eval/{slug}.json` + `tests/eval/run.ts`; CI on PRs touching `lib/extraction/real.ts`

**D-22: Hallucination Guard**
- Case-insensitive substring match with whitespace normalization against full transcript
- Drop offending exercise on mismatch (do NOT retry); flag workout for low-confidence banner if ≥1 dropped

**D-23: Low-Confidence Banner**
- Fires when ANY: LLM returns `extraction_confidence: "low"` OR <3 exercises OR <200-word transcript OR ≥1 sourceQuote dropped
- Copy: "Heads up — this extraction may be incomplete. Skim the source video for anything we missed."
- Amber/yellow accent; `role="status"`; above `<WorkoutHeader>`; dismissible (local state, not persisted)

**D-24: /about Page**
- Standalone `/about` static route; plain-language; 3 sections (What this is / AI accuracy / DMCA)
- DMCA contact: `hello@exercised.app` — **BLOCKER: must be reachable before launch**

**D-25: Schema Migration**
- Add `video_url: z.string().url().nullable()` to `WorkoutSchema`
- No schema_version bump; backward-compatible
- Update `<ActionBar>` Watch-on-YouTube link to prefer `video_url`; backfill 5 Phase 1 fixtures

**D-26: Cache Semantics**
- Key: `extract:v1:${videoId}`; TTL: 30 days
- Stores full validated WorkoutSchema JSON (not raw captions)
- Cache-stampede protection: Redis lock with 30-second timeout; blocked requests read from cache on lock release
- Cache reads do NOT consume rate-limit quota; render "⚡ Cached" badge

**D-27: Smoke Test Mechanics**
- Vercel Cron at `0 9 * * *` (09:00 UTC daily); hits `/api/extract` with known-good fixture-captioned video
- Alert via Resend email to project owner
- Failure also opens GitHub Issue via GitHub REST API (`POST /repos/{owner}/{repo}/issues`)

### Claude's Discretion
- Whether to use `generateText({ output: Output.object() })` (new AI SDK 6 API) or `generateObject` (older but still functional)
- Prompt template wording for LLM extraction
- Exact Redis key naming beyond `extract:v1:` prefix
- Whether `BUDGET_EXHAUSTED` is separate error code or sub-type of `RATE_LIMITED` in the error enum
- Whether low-confidence banner uses existing shadcn `Alert` variant or custom `<ConfidenceBanner>`

### Deferred Ideas (OUT OF SCOPE)
- Audio-fallback path (Whisper / `gpt-4o-mini-transcribe`) — Phase 3
- Per-exercise jump-to-timestamp link — Phase 4
- `/eval` dashboard route — Phase 4+
- Slack / Discord alert channel — post-v1
- Formal legalese for `/about` — post-v1
- Cache-warming for eval-set URLs on deploy — deferred
- Per-IP analytics dashboard — Phase 4+
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTR-01 | `/api/extract` fetches YouTube captions via `youtube-caption-extractor` with `youtube-transcript` fallback before considering audio | Caption library API patterns, failure-mode routing |
| EXTR-02 | Extracted text structured into `Workout` schema via Vercel AI SDK `generateText({ output: Output.object() })` against GPT-4o with OpenAI Structured Outputs | AI SDK 6 API, structured outputs mode, schema limitations |
| EXTR-03 | Hallucination guard: every exercise `sourceQuote` validated to appear in transcript before returning to client | Substring normalization pattern, drop-not-retry approach |
| EXTR-04 | Eval set of 9 hand-labeled videos + 1 non-fitness control gates ship; non-fitness → NO_WORKOUT blocks release | Eval runner architecture, fixture structure |
| COST-01 | `videoId` cache (Upstash Redis, 30-day TTL) returns prior extractions for repeat URLs without AI call | Redis GET/SET with TTL, stampede lock pattern |
| COST-02 | Per-IP rate limit via `@upstash/ratelimit` sliding window (~5/hr, ~20/day) on `/api/extract` | Two-limiter pattern, `x-forwarded-for` on Vercel |
| COST-03 | Global daily spend cap (Redis INCR counter) halts new extractions when crossed | INCR+EX atomic counter, midnight UTC boundary |
| COST-04 | OpenAI dashboard budget cap and Vercel Spend Management cap configured before first real key deployed | OpenAI project limits (alert-only in 2026), Vercel Spend Management (Pro plan required for auto-pause) |
| ERRS-04 | Low-confidence extraction surfaces banner on output explaining results may be incomplete | Multi-signal banner logic, shadcn Alert component |
| OPS-04 | DMCA contact page and basic ToS/AI-disclaimer page exist before real pipeline ships | `/about` static page structure |
| OPS-05 | Daily smoke test extracts known-good YouTube video and alerts on failure | Vercel Cron (Hobby = once/day), Resend email, GitHub Issues REST API |
</phase_requirements>

---

## Summary

Phase 2 replaces the `RealExtractionService` stub at `lib/extraction/real.ts` with a production captions-first pipeline: `youtube-caption-extractor` → `youtube-transcript` fallback → `generateText({ output: Output.object(WorkoutSchema) })` against GPT-4o. This ships atomically with a full 8-defense cost-protection stack: per-IP sliding-window rate limit (two instances: hourly + daily), videoId cache with stampede lock, global daily spend cap via Redis INCR, OpenAI org-level budget alert, and application-level controls.

The AI SDK changed its primary structured-generation API from the `generateObject` function to `generateText({ output: Output.object() })` in v6. Both still work, but `generateText + Output.object()` is the current v6 pattern. OpenAI Structured Outputs mode (grammar-level enforcement) is enabled by default when using `Output.object()` with the OpenAI provider — the `strictJsonSchema: true` default eliminates the ~3-8% malformed JSON failure rate from prompt-only approaches. The critical schema constraint: OpenAI does not support optional properties — use `.nullable()` not `.optional()` or `.nullish()`.

Two key environmental discoveries affect planning: (1) **Vercel Hobby plan cron jobs run at most once per day** with ±59 minute precision — D-27a `0 9 * * *` is valid but fires anywhere 09:00–09:59 UTC. (2) **Vercel Spend Management auto-pause is Pro-only** — on Hobby, it sends email/web alerts only. The application-level Redis spend cap (D-20c) is the hard enforcement mechanism for v1.

**Primary recommendation:** Implement `generateText({ output: Output.object(WorkoutSchema) })` with the `@ai-sdk/openai` provider. Use two `Ratelimit` instances (separate prefixes) for hourly + daily limits; check both sequentially. Use Redis `SET NX EX` for stampede lock and `INCR` + `EXPIRE` for the daily spend counter.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Caption fetch | API / Backend | — | Network call to YouTube's unofficial endpoints; must be server-side to avoid CORS and hide Vercel IP in serverless context |
| LLM structuring (GPT-4o) | API / Backend | — | OpenAI API call; requires OPENAI_API_KEY; never exposed to client |
| Rate limiting (per-IP) | API / Backend | — | Redis check at request entry; must be server-side; client IP read from `x-forwarded-for` set by Vercel |
| Global spend cap | API / Backend | — | Redis INCR; server-side atomic counter |
| VideoId cache (read + write) | API / Backend | — | Redis GET/SET; avoids redundant AI calls; happens inside route handler |
| Hallucination guard | API / Backend | — | Substring validation on full transcript text; server-side before emitting result SSE event |
| Low-confidence banner | Frontend / Client | — | Triggered by fields in the `result` SSE event (extraction_confidence, routine length); rendered in WorkoutView |
| SSE event emission | API / Backend | — | Extends existing route.ts SSE pattern; same 4 critical headers |
| Eval runner | Development tooling | CI | pnpm script; Vitest-based; not runtime |
| Daily smoke test | API / Backend | Vercel Cron | GET handler at `/api/cron/smoke`; called by Vercel Cron; validates extraction |
| DMCA / /about page | Frontend / Static | — | Next.js App Router static page; no API surface |
| Rate-limit badge / BUDGET_EXHAUSTED UI | Frontend / Client | — | New error code in SSE schema; existing `ErrorState` + new `BUDGET_EXHAUSTED` variant |

---

## Standard Stack

### Core (all locked in CONTEXT.md / PROJECT.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | 6.0.184 | `generateText({ output: Output.object() })` structured extraction | Locked. Grammar-level schema enforcement via OpenAI Structured Outputs; auto-retries on generation failure; abstracts provider. [VERIFIED: npm registry] |
| `@ai-sdk/openai` | 3.0.64 | OpenAI provider for Vercel AI SDK | Locked. Required for GPT-4o access via AI SDK. [VERIFIED: npm registry] |
| `openai` | 6.38.0 | Whisper transcription (Phase 3) — install now for consistency | Locked for Phase 3; install in Phase 2 for `.env` completeness. [VERIFIED: npm registry] |
| `youtube-caption-extractor` | 1.10.2 | Primary YouTube caption fetcher | Locked. `getSubtitles()` / `getVideoDetails()` API; prefers manual captions over auto-generated; throws on failure (use `getVideoDetails` for graceful empty-array on failure). [VERIFIED: npm registry] |
| `youtube-transcript` | 1.3.1 | Fallback caption fetcher | Locked. Different internal client path → complementary failure modes vs. primary extractor. [VERIFIED: npm registry] |
| `@upstash/ratelimit` | 2.0.8 | Per-IP sliding window rate limiting | Locked. HTTP-based, serverless-native; sliding-window algorithm built-in. [VERIFIED: npm registry] |
| `@upstash/redis` | 1.38.0 | Redis client for cache + spend counter | Locked. HTTP-based; works in Vercel Node.js runtime; same client for ratelimit + cache. [VERIFIED: npm registry] |
| `resend` | 6.12.3 | Smoke-test alert email | Locked (D-27c). Simple Node.js SDK; free tier; no SMTP config. [VERIFIED: npm registry] |
| `zod` | 4.4.3 (already installed) | WorkoutSchema enforcement in `generateText` call | Already installed Phase 1. AI SDK 6 + Zod 4 confirmed compatible. [VERIFIED: npm registry] |

### Installation

```bash
pnpm add ai @ai-sdk/openai openai youtube-caption-extractor youtube-transcript @upstash/ratelimit @upstash/redis resend
```

---

## Package Legitimacy Audit

> slopcheck was not available at research time. All packages verified against npm registry with publish dates.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `youtube-caption-extractor` | npm | 3 yrs (created 2023-05-04) | github.com/devhims/youtube-caption-extractor | [ASSUMED] | Approved — 3 years old, active maintenance (latest 2026-05-16), GitHub repo present with documented API |
| `youtube-transcript` | npm | ~4 yrs (created ~2022) | github.com/Kakulukian/youtube-transcript | [ASSUMED] | Approved — 560 GitHub stars, 116 forks, 4yr age, documented TypeScript API |
| `@upstash/ratelimit` | npm | 3 yrs (created 2022-05-06) | github.com/upstash/ratelimit-js | [ASSUMED] | Approved — official Upstash package, 3yr age, official docs at upstash.com/docs |
| `@upstash/redis` | npm | 4.5 yrs (created 2021-10-22) | github.com/upstash/redis-js | [ASSUMED] | Approved — official Upstash package, 4.5yr age |
| `ai` | npm | Well-established | github.com/vercel/ai | [ASSUMED] | Approved — official Vercel package, homepage at ai-sdk.dev |
| `@ai-sdk/openai` | npm | Well-established | github.com/vercel/ai | [ASSUMED] | Approved — official Vercel package |
| `openai` | npm | 5.5 yrs (created 2020-07-09) | github.com/openai/openai-node | [ASSUMED] | Approved — official OpenAI package |
| `resend` | npm | ~8 yrs root, current API 2-3 yrs | github.com/resend/resend-node | [ASSUMED] | Approved — official Resend package, 6yr age |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** All 8 packages confirmed to have no `postinstall` scripts. [VERIFIED: npm registry — npm view <pkg> scripts.postinstall returned empty for all packages]

*slopcheck was unavailable at research time — all packages tagged [ASSUMED]. The planner should treat these as requiring a quick human spot-check before installation. All packages verified on npm registry with multi-year history, GitHub source repos, and official organizational backing.*

---

## Architecture Patterns

### System Architecture Diagram

```
User Browser
    │  POST /api/extract { url }
    ▼
[Vercel Node.js Function — app/api/extract/route.ts]
    │
    ├─ 1. parseYouTubeUrl(url)           → videoId (existing)
    ├─ 2. checkRateLimit(ip, hourly)     → 429 → RATE_LIMITED SSE
    ├─ 3. checkRateLimit(ip, daily)      → 429 → RATE_LIMITED SSE
    ├─ 4. checkGlobalSpendCap()          → BUDGET_EXHAUSTED SSE
    ├─ 5. Redis GET extract:v1:{videoId} → cache hit → result SSE (free)
    │         ↓ miss
    ├─ 6. Redis SET LOCK NX EX 30        → lock acquired (stampede guard)
    │         ↓ lock held by other request → poll / read cache after lock release
    │
    ├─ 7. SSE: emit "fetching"
    ├─ 8. getCaptions(videoId)
    │         ├── getVideoDetails({ videoID, lang: 'en' })  → subtitles[]
    │         └── fallback: fetchTranscript(videoId)        → TranscriptResponse[]
    │         ↓ both fail → NO_WORKOUT SSE
    │
    ├─ 9. SSE: emit "transcribing"  (caption text assembled)
    │
    ├─10. SSE: emit "analyzing"
    ├─11. generateText({
    │       model: openai('gpt-4o'),
    │       output: Output.object({ schema: WorkoutSchema }),
    │       system: EXTRACTION_SYSTEM_PROMPT,
    │       prompt: transcript
    │     })
    │         ↓ NO_WORKOUT response (extraction_confidence + empty routine)
    │         ↓ → NO_WORKOUT SSE
    │
    ├─12. SSE: emit "generating"
    ├─13. validateSourceQuotes(workout, transcript)
    │         ↓ drops exercises with no substring match
    │         ↓ sets lowConfidence flag if any dropped
    │
    ├─14. Redis INCR global spend counter + EXPIRE to midnight UTC
    ├─15. Redis SET extract:v1:{videoId} JSON(workout) EX 2592000
    ├─16. Redis DEL LOCK (release stampede lock)
    │
    ├─17. SSE: emit result { workout, lowConfidence, cached: false }
    └───────────────────────────────────────────────────────────────

[Vercel Cron — GET /api/cron/smoke  (0 9 * * *)]
    ├─ auth: check Authorization: Bearer $CRON_SECRET
    ├─ fetch /api/extract with smoke.json test URL (no rate-limit check for cron IP)
    ├─ validate result matches expected
    ├─ on failure: POST Resend email + POST GitHub Issue
    └─ return 200 OK
```

### Recommended Project Structure

```
lib/
├── extraction/
│   ├── service.ts         # (existing) factory
│   ├── mock.ts            # (existing) mock service
│   ├── real.ts            # Phase 2: REPLACE stub with RealExtractionService
│   └── captions.ts        # getCaptions(videoId): Promise<string> — primary + fallback
├── ai/
│   └── extract.ts         # callLLM(transcript): Promise<Workout> — generateText + Output.object
├── guards/
│   └── sourceQuote.ts     # validateSourceQuotes(workout, transcript) — drop + flag
├── ratelimit/
│   └── index.ts           # hourlyLimiter, dailyLimiter — two Ratelimit instances
├── cache/
│   └── videoCache.ts      # getCached(videoId), setCached(videoId, workout), stampede lock
├── spend/
│   └── cap.ts             # checkSpendCap(), incrementSpend() — Redis INCR pattern
├── schema/
│   └── workout.ts         # (existing) — D-25 adds video_url field
app/
├── api/
│   ├── extract/
│   │   └── route.ts       # (existing) — Phase 2 orchestrates all defenses
│   └── cron/
│       └── smoke/
│           └── route.ts   # GET handler; CRON_SECRET auth; smoke test logic
├── about/
│   └── page.tsx           # D-24 static DMCA + ToS + AI disclaimer page
components/
├── extract/
│   ├── ExtractFlow.tsx    # (existing) — add BUDGET_EXHAUSTED handling
│   ├── ErrorState.tsx     # (existing) — add 5th BUDGET_EXHAUSTED variant
│   └── ConfidenceBanner.tsx  # NEW — D-23 amber banner above WorkoutHeader
tests/
├── eval/
│   ├── run.ts             # D-21 eval runner — pnpm eval
│   ├── smoke.json         # D-27b known-good fixture-captioned video
│   └── {slug}.json        # D-21b 9 eval fixtures (8 fitness + 1 control)
├── fixtures/              # (existing) 5 Phase 1 fixtures — D-25 backfill video_url
└── share-url-roundtrip.test.ts  # (existing) — rerun after D-25 schema change
```

### Pattern 1: Two-Ratelimiter Pattern (D-20a + D-20b)

Both limiters must pass; first failure wins.

```typescript
// Source: https://upstash.com/docs/redis/sdks/ratelimit-ts/features
// Source: https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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

// In route.ts — check both; return first failure
export async function checkRateLimit(ip: string) {
  const hourly = await hourlyLimiter.limit(ip);
  if (!hourly.success) return { limited: true, remaining: hourly.remaining, reset: hourly.reset };

  const daily = await dailyLimiter.limit(ip);
  if (!daily.success) return { limited: true, remaining: daily.remaining, reset: daily.reset };

  return { limited: false };
}
```

**Response shape from `limit()`:** `{ success: boolean, limit: number, remaining: number, reset: number (unix ms), pending: Promise, reason?: string }`

### Pattern 2: Client IP Extraction on Vercel (D-20a)

```typescript
// Source: https://vercel.com/docs/headers/request-headers
// Vercel OVERWRITES x-forwarded-for — it is the true client IP, not spoofable
// Do NOT parse comma-separated list; Vercel sets it to a single IP
export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")
    ?? req.headers.get("x-real-ip")
    ?? "127.0.0.1"; // fallback for local dev
}
```

**Key finding:** On Vercel, `x-forwarded-for` is set by Vercel's edge to the true client IP and **cannot be spoofed by the client**. Vercel overwrites any incoming `X-Forwarded-For` header. Use `x-forwarded-for` directly — do NOT take first/last element of a comma-separated list (there is no list on Vercel; it is a single IP). [VERIFIED: vercel.com/docs/headers/request-headers]

### Pattern 3: Global Daily Spend Cap (D-20c)

```typescript
// Source: https://redis.io/docs/latest/commands/incr/
// Source: Upstash @upstash/redis docs
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Key: spend counter resets daily at midnight UTC
function getDailySpendKey(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // "2026-05-17"
  return `spend:daily:${date}`;
}

// Returns seconds until midnight UTC
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

export async function checkSpendCap(): Promise<boolean> {
  // D-20c: $5/day cap ≈ 250 extractions at ~$0.02/extraction
  // Use extraction count (simpler, predictable) not dollar tracking
  const CAP = parseInt(process.env.DAILY_EXTRACTION_CAP ?? "250");
  const key = getDailySpendKey();
  const current = await redis.get<number>(key) ?? 0;
  return current < CAP;
}

export async function incrementSpend(): Promise<void> {
  const key = getDailySpendKey();
  const count = await redis.incr(key);
  // Set TTL on first increment (or every time — EXPIRE is idempotent enough here)
  // Use EX slightly beyond midnight to survive clock skew
  if (count === 1) {
    await redis.expire(key, secondsUntilMidnightUTC() + 3600);
  }
}
```

**Design choice:** Count extractions (not dollars) for the global cap. Simpler, no per-call cost calculation needed. $0.02 avg × 250 = $5 target. Tunable: store `DAILY_EXTRACTION_CAP` as a Redis string key (not just env var) for hot-reload without redeploy per D-20c. [ASSUMED — exact pattern not from official docs; derived from Redis INCR semantics]

### Pattern 4: Cache + Stampede Lock (D-26)

```typescript
// Source: cache stampede prevention Redis pattern
// Source: Upstash @upstash/redis SDK
import { Redis } from "@upstash/redis";
import type { Workout } from "@/lib/schema/workout";

const redis = Redis.fromEnv();
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const LOCK_TTL_SECONDS = 30;

function cacheKey(videoId: string) { return `extract:v1:${videoId}`; }
function lockKey(videoId: string)  { return `lock:extract:v1:${videoId}`; }

export async function getCached(videoId: string): Promise<Workout | null> {
  return redis.get<Workout>(cacheKey(videoId));
}

export async function setCached(videoId: string, workout: Workout): Promise<void> {
  await redis.set(cacheKey(videoId), JSON.stringify(workout), { ex: CACHE_TTL_SECONDS });
}

// Returns true if lock acquired; false if lock already held (another request is in flight)
export async function acquireLock(videoId: string): Promise<boolean> {
  // SET key value NX EX ttl — atomic; returns "OK" if set, null if already exists
  const result = await redis.set(lockKey(videoId), "1", { nx: true, ex: LOCK_TTL_SECONDS });
  return result === "OK";
}

export async function releaseLock(videoId: string): Promise<void> {
  await redis.del(lockKey(videoId));
}

// Caller pattern in route.ts:
// const cached = await getCached(videoId);
// if (cached) { yield { type: "result", workout: cached, cached: true }; return; }
// const locked = await acquireLock(videoId);
// if (!locked) {
//   // Poll up to 30s for cache population by the lock holder
//   for (let i = 0; i < 30; i++) {
//     await sleep(1000);
//     const ready = await getCached(videoId);
//     if (ready) { yield { type: "result", workout: ready, cached: true }; return; }
//   }
//   // Timed out — proceed without lock (last-write-wins, acceptable for v1)
// }
```

### Pattern 5: Vercel AI SDK `generateText + Output.object()` (EXTR-02)

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai (structuredOutputs)
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { WorkoutSchema } from "@/lib/schema/workout";
import type { Workout } from "@/lib/schema/workout";

export async function extractWorkout(transcript: string, videoUrl: string): Promise<Workout> {
  const { experimental_output } = await generateText({
    model: openai("gpt-4o"),              // Structured Outputs enabled by default
    output: Output.object({ schema: WorkoutSchema }),
    maxRetries: 2,                        // default; retries on network/rate errors
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Extract a structured workout from the following YouTube video transcript:\n\n${transcript}`,
  });

  // experimental_output is typed as Workout (inferred from WorkoutSchema)
  return { ...experimental_output, video_url: videoUrl };
}
```

**CRITICAL schema constraint (EXTR-02):** OpenAI Structured Outputs does not support optional properties. All nullable fields in `WorkoutSchema` MUST use `.nullable()` — already the case in the existing schema. `.optional()`, `.nullish()`, and fields with Zod `.default()` may cause issues. Verify `WorkoutSchema` after D-25 adds `video_url: z.string().url().nullable()`. [VERIFIED: ai-sdk.dev/providers/ai-sdk-providers/openai]

**API note:** The current AI SDK 6 API uses `generateText({ output: Output.object({ schema }) })` rather than the older `generateObject({ schema })`. `generateObject` still works in AI SDK 6 but the `generateText + Output` pattern is the documented v6 approach. Either works; pick `generateText + Output.object()` for v6 consistency.

**maxRetries:** Default is 2. Set to 0 to disable. Retries apply to network failures and rate limit errors from OpenAI — NOT to Zod schema validation failures (those throw `NoObjectGeneratedError` immediately). [VERIFIED: ai-sdk.dev/docs/ai-sdk-core/settings]

**Structured Outputs mode:** Enabled by default on `@ai-sdk/openai` provider. Provides grammar-level JSON enforcement — the model cannot produce output that fails to parse as the declared schema. Disable only with `providerOptions: { openai: { strictJsonSchema: false } }`. Do not disable. [VERIFIED: ai-sdk.dev/providers/ai-sdk-providers/openai]

### Pattern 6: Hallucination Guard / sourceQuote Validation (D-22)

```typescript
// D-22: case-insensitive substring with whitespace normalization
// Source: D-22 decision; implementation pattern is Claude's discretion

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function isSubstring(quote: string, transcript: string): boolean {
  if (!quote) return false;
  return normalize(transcript).includes(normalize(quote));
}

export function validateSourceQuotes(workout: Workout, transcript: string): {
  workout: Workout;
  droppedCount: number;
} {
  let droppedCount = 0;

  const filteredRoutine = workout.routine.flatMap((item) => {
    if (item.type === "standard_set") {
      if (item.sourceQuote && !isSubstring(item.sourceQuote, transcript)) {
        droppedCount++;
        return []; // drop exercise
      }
      return [item];
    }
    // superset: filter inner exercises, drop superset if all inner exercises dropped
    const filteredExercises = item.exercises.filter((ex) => {
      if (ex.sourceQuote && !isSubstring(ex.sourceQuote, transcript)) {
        droppedCount++;
        return false;
      }
      return true;
    });
    if (filteredExercises.length < 2) {
      // superset needs ≥2 exercises; promote survivors to standard_set or drop
      droppedCount += item.exercises.length - filteredExercises.length;
      return filteredExercises.map((ex) => ({ ...ex, type: "standard_set" as const }));
    }
    return [{ ...item, exercises: filteredExercises }];
  });

  return {
    workout: { ...workout, routine: filteredRoutine },
    droppedCount,
  };
}
```

**Null handling:** If `sourceQuote` is `null`, the exercise passes the guard (null means "no quote provided" — not a hallucination). Only non-null quotes that fail the substring check are dropped.

### Pattern 7: Vercel Cron Smoke Test (D-27)

```typescript
// app/api/cron/smoke/route.ts
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60; // smoke test should complete well within 60s

export async function GET(request: NextRequest) {
  // D-27 auth: Vercel sends Authorization: Bearer $CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... run smoke test, send Resend email on failure, open GitHub Issue on failure
}
```

`vercel.json` cron entry:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/smoke",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**CRITICAL: Hobby plan cron limitation.** Hobby accounts allow at most once-per-day cron execution. `0 9 * * *` is valid (once daily). Precision on Hobby is ±59 minutes — actual invocation is anywhere 09:00–09:59 UTC. [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing]

### Pattern 8: Caption Fetch with Fallback (EXTR-01)

```typescript
// Source: https://github.com/devhims/youtube-caption-extractor (getVideoDetails API)
// Source: https://github.com/Kakulukian/youtube-transcript (fetchTranscript API)
import { getVideoDetails } from "youtube-caption-extractor";
import { YoutubeTranscript } from "youtube-transcript";

export async function getCaptions(videoId: string): Promise<string | null> {
  // Primary: youtube-caption-extractor
  // getVideoDetails returns { subtitles: [] } on failure (no throw)
  try {
    const details = await getVideoDetails({ videoID: videoId, lang: "en" });
    if (details.subtitles.length > 0) {
      return details.subtitles.map((s) => s.text).join(" ");
    }
  } catch {
    // library threw — fall through to fallback
  }

  // Fallback: youtube-transcript
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript.length > 0) {
      return transcript.map((t) => t.text).join(" ");
    }
  } catch {
    // fallback also failed
  }

  return null; // no captions available → route.ts emits NO_WORKOUT
}
```

**Caption type note:** Both libraries prefer human-authored captions over auto-generated when both exist. Auto-generated captions ARE included when no manual captions exist — do not reject them. For workout videos, auto-generated captions are typically sufficient for exercise name and rep extraction. [VERIFIED: github.com/devhims/youtube-caption-extractor README]

### Anti-Patterns to Avoid

- **Using `generateObject` with `mode: "json"` (non-Structured-Outputs):** This uses a "respond in JSON" prompt rather than grammar-level enforcement. Results in ~3-8% malformed JSON. Stick with default Structured Outputs mode via `Output.object()`.
- **Reading only the first element of `x-forwarded-for`:** Not needed on Vercel — Vercel sets it to a single IP, not a comma list.
- **Using `.optional()` in WorkoutSchema fields:** OpenAI Structured Outputs rejects optional fields. Use `.nullable()` with `null` as the "absent" sentinel.
- **Using `getSubtitles()` instead of `getVideoDetails()`:** `getSubtitles()` throws on failure; `getVideoDetails()` returns empty array on failure. Use `getVideoDetails()` to avoid error handling boilerplate.
- **Storing raw caption text in the cache:** Cache the validated WorkoutSchema JSON (post-hallucination-guard). Avoids re-running validation on every cache hit.
- **Calling `redis.expire()` on every INCR call for the spend counter:** Risk of resetting TTL on every request. Set TTL only on `count === 1` (first INCR of the day). Alternatively, use `redis.set(key, "0", { ex: ttl, nx: true })` before the INCR.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting with sliding window | Custom Redis Lua script counter | `@upstash/ratelimit` | Edge cases around window boundaries, clock skew, atomic operations — all handled |
| Structured LLM output with schema enforcement | Prompt-only JSON mode + manual parse | `generateText + Output.object()` | 3-8% malformed JSON rate without grammar enforcement; AI SDK handles retry + error reporting |
| YouTube IP spoofing protection | Custom IP parsing / trust headers | Read `x-forwarded-for` directly on Vercel | Vercel overwrites the header — it is already the true client IP |
| Redis distributed lock | Manual poll + SETNX + EXPIRE as two calls | `SET key value NX EX ttl` single atomic command | Two-command pattern has a race window between SETNX success and EXPIRE |
| Cache stampede prevention | Allow concurrent LLM calls | Redis SET NX lock | Multiple concurrent OpenAI calls for same video = 10× cost at launch spike |
| Email alerting | SMTP server + DNS records | `resend` npm SDK | Resend free tier handles v1 alert volume; zero ops overhead |

---

## Common Pitfalls

### Pitfall 1: Caption Library IP Blocking (LOGIN_REQUIRED)

**What goes wrong:** Both `youtube-caption-extractor` and `youtube-transcript` hit unofficial YouTube endpoints. Vercel's shared serverless IP ranges trigger YouTube's bot detection, returning `LOGIN_REQUIRED` or empty responses.

**Why it happens:** YouTube blocks high-volume datacenters. Vercel serverless functions share IP pools, which YouTube has pattern-matched.

**How to avoid:** (1) Implement retry with exponential backoff (3 attempts, 1s/2s/4s delays) before declaring failure. (2) Cache aggressively (D-26 30-day TTL means popular videos only hit YouTube's servers once). (3) Phase 3 audio fallback covers the cases where captions truly fail — but for Phase 2, if both libraries fail after retries, emit `NO_WORKOUT` and document the failure mode in the eval set.

**Warning signs:** `NO_WORKOUT` rate unexpectedly high (>10%) for clearly-captioned workout videos in eval set. Check YouTube API error messages in logs.

### Pitfall 2: OpenAI Structured Outputs + Zod `.optional()` Fields

**What goes wrong:** `generateText({ output: Output.object({ schema }) })` with a Zod schema containing `.optional()` fields throws an API error from OpenAI.

**Why it happens:** OpenAI Structured Outputs requires all schema properties to be either required or `.nullable()`. Optional properties (properties that can be absent from the JSON object) are not supported.

**How to avoid:** Audit `WorkoutSchema` for any `.optional()` or `.nullish()` usage. Convert all to `.nullable()`. The D-25 `video_url` field must be `.nullable()` (already specified). Fields with `.default([])` in existing schema may also need review.

**Warning signs:** `NoObjectGeneratedError` with a message mentioning schema validation during the `generateText` call — before any response is generated.

### Pitfall 3: Vercel Hobby Cron Precision (±59 minutes)

**What goes wrong:** Smoke test at `0 9 * * *` is expected to fire at 09:00 UTC. On Hobby, it fires anywhere from 09:00 to 09:59.

**Why it happens:** Vercel distributes Hobby cron invocations across the hour to manage load.

**How to avoid:** Design the smoke test to be time-independent (it asserts extraction correctness, not speed or exact timing). Log the actual invocation timestamp in the smoke test output. If precise timing becomes critical, upgrade to Pro.

**Warning signs:** Smoke test email arriving at unexpected times — this is normal on Hobby.

### Pitfall 4: Midnight UTC Boundary Race for Global Spend Cap

**What goes wrong:** Requests that arrive within seconds of midnight UTC may read yesterday's counter (under cap) but increment today's counter, or vice versa.

**Why it happens:** `getDailySpendKey()` uses current date in UTC; clock skew between requests and the Redis server can cause off-by-one-day issues.

**How to avoid:** (1) Set the spend counter TTL to `secondsUntilMidnightUTC() + 3600` — the extra hour allows the old key to remain visible during clock skew. (2) Accept that the cap may occasionally allow 1-2 extra extractions at the boundary — it is not a financial hard-limit (that's OpenAI's org-level cap, D-20c is application-level). (3) Do not use calendar date in the key format; the TTL expiry is the source of truth for reset.

**Warning signs:** Spend cap appears to not reset properly on some days. Check Redis TTL values on the spend key.

### Pitfall 5: Hallucination Guard Drops Too Many Exercises on Auto-Generated Captions

**What goes wrong:** Auto-generated captions have typos, merged words, and inconsistent spacing. The sourceQuote from the LLM (which reads clean text) may not substring-match the raw garbled auto-caption text.

**Why it happens:** GPT-4o often "corrects" or normalizes transcription noise when generating the workout. The resulting sourceQuote is semantically accurate but does not appear verbatim in the raw caption.

**How to avoid:** (1) Whitespace normalization in `normalize()` handles most cases. (2) Consider applying the same normalization to the transcript before feeding it to the LLM — if the LLM sees normalized text, its sourceQuotes will match normalized text. (3) The prompt should instruct the LLM to use verbatim phrases from the transcript for sourceQuote, not paraphrased or corrected text. (4) Monitor `droppedCount` in the eval set — if ≥30% of exercises are dropped for a video, the guard is too strict.

**Warning signs:** Low-confidence banner fires on 80%+ of eval-set videos. High `droppedCount` even for well-captioned videos.

### Pitfall 6: SSE Response Headers — All 4 Must Remain Unchanged

**What goes wrong:** Adding rate-limit or cache logic upstream of the SSE stream breaks Vercel's response buffering if the 4 critical headers are not propagated to the final `Response`.

**Why it happens:** Early-return error responses (RATE_LIMITED, BUDGET_EXHAUSTED) use `Response.json(...)` not the SSE stream — these are fine. But if the code path proceeds to stream setup, the SSE headers must be present.

**How to avoid:** Keep the same `return new Response(stream, { headers: { ... 4 headers ... } })` pattern from Phase 1. RATE_LIMITED and BUDGET_EXHAUSTED are emitted as SSE events INSIDE the stream (the connection opens then immediately sends the error event and closes) — NOT as HTTP error responses. This matches how `ExtractFlow.tsx` already consumes events.

**Warning signs:** SSE stream appears to hang or not deliver events in Vercel production despite working in local dev.

### Pitfall 7: Vercel Spend Management Does NOT Auto-Pause on Hobby Plan

**What goes wrong:** COST-04 specifies "OpenAI dashboard budget cap and Vercel Spend Management cap configured." If the assumption is that Vercel will automatically stop traffic, it won't on Hobby.

**Why it happens:** Vercel Spend Management auto-pause (project pausing) is a Pro plan feature only. On Hobby, exceeding limits stops traffic by Vercel's hard caps — but there is no configurable spend threshold for this.

**How to avoid:** For COST-04 on Hobby: (1) Configure OpenAI org-level monthly budget alert (alerts are free; hard stop on OpenAI side). (2) The application-level Redis global spend cap (D-20c) is the primary enforcement layer. (3) Verify the user's Vercel plan before claiming Spend Management auto-pause is configured. If on Hobby, document this limitation explicitly in the COST-04 verification checklist.

**Warning signs:** None at runtime — this is a configuration documentation issue, not a runtime failure.

---

## Code Examples

### LLM Extraction System Prompt (Draft)

```typescript
// Source: D-21 / D-22 / D-23 requirements; draft prompt for planner refinement
export const EXTRACTION_SYSTEM_PROMPT = `
You are a fitness content analyzer. Extract a structured workout routine from the YouTube video transcript provided.

Rules:
1. Only extract exercises that are explicitly mentioned in the transcript. Do not invent exercises.
2. For each exercise, provide a sourceQuote: a verbatim phrase (3-10 words) from the transcript that confirms this exercise exists. Copy it exactly as it appears in the transcript, including any transcription artifacts.
3. If the transcript does not contain a fitness workout routine (cooking, gaming, lifestyle, etc.), set extraction_confidence to "low" and return an empty routine array.
4. If the transcript is unclear, partial, or ambiguous, set extraction_confidence to "low".
5. For timed exercises (HIIT, yoga), use reps like "30 seconds" or "AMRAP".
6. Estimate sets/reps/rest from context; use reasonable defaults (3 sets, 10 reps) only when clearly implied.
7. The workout_title should be descriptive of the video content.
8. creator_username: use the handle/name mentioned in the video, or "unknown" if not mentioned.

Return a complete, valid workout matching the schema. If no workout found, return extraction_confidence "low" with empty routine.
`.trim();
```

### GitHub Issue Creation from Cron Handler

```typescript
// Source: https://docs.github.com/en/rest/issues/issues#create-an-issue
export async function openGitHubIssue(title: string, body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // e.g. "username/exercised"
  if (!token || !repo) return;

  await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["smoke-test-failure"] }),
  });
}
```

### Resend Alert Email

```typescript
// Source: https://resend.com/docs/send-with-nodejs
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSmokeAlert(details: string): Promise<void> {
  await resend.emails.send({
    from: "Exercised Smoke Test <smoke@exercised.app>",
    to: [process.env.ALERT_EMAIL ?? "hello@exercised.app"],
    subject: `[Exercised] Daily Smoke Test Failed — ${new Date().toISOString().slice(0, 10)}`,
    html: `<p>The daily smoke test for Exercised failed.</p><pre>${details}</pre>`,
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject({ schema })` | `generateText({ output: Output.object({ schema }) })` | AI SDK v6 (2025) | `generateObject` still works but `Output.object` is the v6 canonical API; use `Output.object` for new code |
| `whisper-1` for transcription | `gpt-4o-mini-transcribe` | 2024 | Lower cost ($0.003/min), better accuracy; Phase 3 concern |
| Prompt-engineered JSON output | OpenAI Structured Outputs (grammar-level) | Mid-2024, SDK integration 2025 | Eliminates malformed JSON failures; enabled by default in `@ai-sdk/openai` |
| Fixed window rate limiting | Sliding window | Long-standing | Prevents burst-at-boundary exploits; use `Ratelimit.slidingWindow()` |

**Deprecated/outdated:**
- `generateObject` function: Still works in AI SDK 6 but `generateText + Output.object()` is the documented v6 pattern. Either is acceptable; pick one and be consistent.
- `mode: "json"` in generateObject: JSON mode without Structured Outputs. Do not use — no grammar enforcement.
- `mode: "tool"` in generateObject: Uses function-calling to extract schema. Slower, less reliable for our use case. Structured Outputs is better.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generateText({ output: Output.object() })` is the canonical AI SDK 6 API for structured extraction (vs `generateObject`) | Standard Stack, Code Examples | If `generateObject` is still preferred in v6, the code examples need updating — low impact since both work |
| A2 | `youtube-caption-extractor@1.10.2` and `youtube-transcript@1.3.1` have complementary failure modes against YouTube's bot detection | Architecture Patterns | If both fail simultaneously on the same IP ranges, NO_WORKOUT rate will be high — Phase 3 audio path would need acceleration |
| A3 | Auto-generated YouTube captions are sufficient for fitness workout extraction (exercise names, sets, reps) | Pitfall 5 | If quality is too low, sourceQuote validation will drop most exercises — would need to filter for manual captions only or use audio path |
| A4 | Redis `INCR` + `EXPIRE` pattern for daily spend counter is safe against midnight UTC boundary at v1 traffic volumes | Pattern 3 | At extremely high concurrency at midnight, a 1-2 extraction overrun is possible — acceptable risk for v1 |
| A5 | `resend` free tier handles v1 smoke alert volume (at most 1 email/day) | Standard Stack | If Resend changes free tier limits, need SMTP fallback — but 1 email/day is well within any reasonable free tier |
| A6 | `getVideoDetails()` (not `getSubtitles()`) is the correct `youtube-caption-extractor` function for graceful failure | Code Examples | If `getVideoDetails` behavior changed since documentation, error handling may differ |
| A7 | OpenAI org-level monthly budget alert (not hard stop) is sufficient for COST-04 on Hobby Vercel | COST-04 requirement | If OpenAI has re-added hard budget cutoffs (search found ambiguity — they may have been removed as of late 2025), this affects the behavior description in COST-04 compliance |

---

## Open Questions (RESOLVED)

1. **`generateObject` vs `generateText + Output.object()` in AI SDK 6**
   - What we know: AI SDK v6 docs focus on `generateText({ output: Output.object() })`. `generateObject` still exists.
   - What's unclear: Whether `generateObject` is deprecated, removed, or still first-class in v6.
   - Recommendation: Use `generateText + Output.object()` as it is the current documented pattern. Planner may want to verify against `ai@6.0.184` package exports.
   - **RESOLVED:** Use `generateText({ output: Output.object(WorkoutSchema) })` per AI SDK 6 docs and RESEARCH Pattern 5. Plans 02-03 and 02-04 implement this. `generateObject` is not used anywhere in Phase 2.

2. **OpenAI Org Budget: Alert vs Hard Stop**
   - What we know: A community post noted "Monthly Budget Limit silently removed" in late 2025, changed to an alert rather than a hard cutoff. The COST-04 requirement says "configured before first real key deployed" — configure as alert.
   - What's unclear: Whether OpenAI has restored hard-stop capability by May 2026.
   - Recommendation: Configure an email alert at $10/month at the OpenAI org level; rely on application-level Redis cap (D-20c) as the hard stop. Document this in COST-04 verification.
   - **RESOLVED:** Assume alert-only on the OpenAI dashboard (not a hard stop). The application-level Redis spend cap (D-20c) is the hard enforcement mechanism. Documented in Plan 02-07 Task 2 owner actions.

3. **Auto-Generated Caption Quality for Fitness Extraction**
   - What we know: YouTube auto-captions are ~60-70% accurate. Exercise names are generally recognizable even with errors.
   - What's unclear: Whether the sourceQuote validation guard will be too strict for auto-generated captions (Pitfall 5).
   - Recommendation: During eval set construction, include at least 2 videos that have only auto-generated captions. Tune the `normalize()` function if needed.
   - **RESOLVED:** Accept auto-captions; eval set (Plan 02-06) includes at least 1 video known to have only auto-generated captions to surface quality issues. Tune `normalize()` if droppedCount is high on that video.

4. **BUDGET_EXHAUSTED as SSE Event vs Error HTTP Response**
   - What we know: D-20e says "new `BUDGET_EXHAUSTED` error code in the SSE event schema" — it is emitted as an SSE error event.
   - What's unclear: Whether `ExtractFlow.tsx` should receive it as an SSE error event (before the SSE stream opens normally) or as an HTTP 429 before the SSE stream starts.
   - Recommendation: Emit as SSE error event inside the stream — consistent with how `RATE_LIMITED` is emitted in the mock. The SSE stream opens, immediately sends the error event, then closes. Frontend handles it identically to RATE_LIMITED.
   - **RESOLVED:** BUDGET_EXHAUSTED is an HTTP 503 response (pre-flight, before the SSE stream opens), per CONTEXT D-20d/e. RATE_LIMITED is HTTP 429. Neither is an SSE event. The SSE error.code enum is NETWORK | NO_WORKOUT | UNKNOWN only. ExtractFlow.tsx checks response.status before entering the SSE consumer (Plan 02-04 Task 3).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vercel runtime | ✓ | Vercel-managed | — |
| pnpm | Package management | ✓ (Phase 1 used it) | Phase 1 lockfile present | — |
| Upstash Redis instance | COST-01/02/03 | ✗ | — | Must create — free tier at upstash.com |
| OpenAI API key | EXTR-02 | ✗ | — | Must obtain — blocks real pipeline |
| Resend API key | OPS-05 alerts | ✗ | — | Must obtain — free tier at resend.com |
| GitHub personal access token | OPS-05 issue creation | ✗ | — | Must create with `repo` scope; store as env var |
| `hello@exercised.app` reachable | OPS-04 + D-24d | ✗ | — | BLOCKER — must be set up before launch per CONTEXT.md |
| Vercel env vars (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, OPENAI_API_KEY) | All AI/cache features | ✗ | — | Must configure in Vercel dashboard before enabling EXTRACT_MODE=real |

**Missing dependencies with no fallback:**
- `hello@exercised.app` email address — Phase 2 cannot ship until reachable (D-24d blocker per CONTEXT.md)
- OpenAI API key — cannot run real pipeline without it
- Upstash Redis instance — cannot run rate limit, cache, or spend cap without it

**Missing dependencies with fallback:**
- GitHub token — smoke test can fall back to email-only alert if GitHub token is not configured (degrade gracefully, log error)
- Resend API key — if unavailable, smoke test can log to Vercel runtime logs only (reduced visibility, acceptable for MVP)

---

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui. Phase 2 adds to this, does not replace.
- **EXTRACT_MODE swap is deliberate:** Flipping to `real` in production must be a deliberate tagged release commit, not a dashboard toggle.
- **All 8 cost defenses must ship in the same PR as the first OpenAI key** — project-level non-negotiable. Planner must structure the plan to make partial merge impossible.
- **Captions-only in Phase 2** — audio fallback (yt-dlp, Whisper) is explicitly Phase 3. Do not add audio path.
- **AsyncIterable<ExtractEvent> interface** — `RealExtractionService` must conform; do not refactor to Promises or callbacks.
- **TDD RED → GREEN per task** — failing test before implementation; eval-set tests, ratelimit tests, cache tests follow this rhythm.
- **Module-load fixture validation pattern** — `RealExtractionService` should validate any hardcoded test data at import time; eval fixtures should be parseable by `WorkoutSchema`.
- **4 critical SSE headers** — must be present on all SSE responses (see `app/api/extract/route.ts`). RATE_LIMITED and BUDGET_EXHAUSTED emit as SSE events inside the stream, not as raw HTTP error responses.
- **`hello@exercised.app`** is a placeholder — phase cannot ship until this email is reachable. Flag as human-action blocker in every plan that touches OPS-04.
- **No auth, no DB in v1** — Upstash Redis is the only persistence layer. No PostgreSQL, no user accounts.

---

## Sources

### Primary (HIGH confidence)
- [Vercel Docs — Request Headers](https://vercel.com/docs/headers/request-headers) — `x-forwarded-for` is true client IP on Vercel, not spoofable; verified 2025-12-13
- [Vercel Docs — Cron Jobs](https://vercel.com/docs/cron-jobs) — cron expressions, how cron invokes routes via HTTP GET
- [Vercel Docs — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — `CRON_SECRET` authorization, Next.js App Router cron handler pattern; verified 2026-02-27
- [Vercel Docs — Cron Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — **Hobby: once per day max, ±59 min precision**; verified 2026-03-04
- [Vercel Docs — Spend Management](https://vercel.com/docs/spend-management) — Pro plan only for auto-pause; alerts at 50%/75%/100%; verified 2026-02-27
- [AI SDK Docs — Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — `Output.object()` API, error types
- [AI SDK Docs — Settings](https://ai-sdk.dev/docs/ai-sdk-core/settings) — `maxRetries` default = 2
- [AI SDK Docs — OpenAI Provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai) — Structured Outputs enabled by default; `strictJsonSchema: false` to disable; optional properties not supported
- [Upstash Ratelimit — Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) — `Ratelimit` instantiation, `limit()` call, `Redis.fromEnv()`
- [Upstash Ratelimit — Methods](https://upstash.com/docs/redis/sdks/ratelimit-ts/methods) — `limit()` response shape: `{ success, limit, remaining, reset, pending, reason }`
- [Upstash Ratelimit — Features](https://upstash.com/docs/redis/sdks/ratelimit-ts/features) — multiple instances pattern with different prefixes
- [GitHub API — Create Issue](https://docs.github.com/en/rest/issues/issues#create-an-issue) — `POST /repos/{owner}/{repo}/issues`, bearer token auth
- [Resend Docs — Send Email](https://resend.com/docs/api-reference/emails/send-email) — `resend` npm package, API endpoint, auth
- [youtube-caption-extractor README](https://github.com/devhims/youtube-caption-extractor) — `getVideoDetails` returns empty subtitles on failure (no throw); `getSubtitles` throws; language priority; bot detection warning

### Secondary (MEDIUM confidence)
- npm registry metadata for all 8 packages — version, publish dates, repository links; verified via `npm view <pkg> --json`
- [Redis INCR docs](https://redis.io/docs/latest/commands/incr/) — atomic increment semantics; key initialized to 0 if missing
- OpenAI community post — monthly budget limit changed from hard stop to alert ~late 2025 (A7 assumption)
- `@upstash/redis` SDK docs — `set(key, val, { ex, nx })` options for SET NX EX atomic pattern

### Tertiary (LOW confidence)
- YouTube auto-caption accuracy (60-70%) — sourced from multiple blog posts; not official YouTube data
- AI SDK `generateObject` deprecation status in v6 — documented as "still works" but unclear if officially deprecated

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry with multi-year history
- Caption library failure modes: MEDIUM — documented in README and community reports but exact behavior may vary by YouTube geography/IP
- AI SDK structured generation: HIGH — verified against official ai-sdk.dev docs
- Upstash rate limiting + caching: HIGH — verified against official Upstash docs
- Vercel Cron constraints: HIGH — verified against official Vercel docs (critical: Hobby plan = once/day)
- OpenAI budget cap behavior: MEDIUM — reported change from hard stop to alert; may have changed again

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — YouTube API stability is the main risk; check for yt-dlp/caption API drift advisories)
