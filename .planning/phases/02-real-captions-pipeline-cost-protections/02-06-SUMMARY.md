---
phase: "02-real-captions-pipeline-cost-protections"
plan: "06"
subsystem: "testing"
tags:
  - eval-runner
  - d21-binary-gate
  - source-quote-verification
  - youtube-shorts
  - vitest
  - redis
  - upstash
dependency_graph:
  requires:
    - 02-03  # getCaptions + validateSourceQuotes used in eval runner
    - 02-04  # /api/extract SSE route consumed by eval runner
    - 02-05  # smoke.json updated with real video
  provides:
    - EXTR-04  # eval gate — binary pass criteria before real pipeline ship
    - OPS-05   # smoke.json updated to real fixture shape
  affects:
    - tests/eval/run.eval.test.ts
    - tests/eval/smoke.json
    - app/api/cron/smoke/route.ts
    - 02-07  # pnpm eval exits 0 is the ship gate for Plan 02-07
tech_stack:
  added:
    - vitest.eval.config.ts (separate vitest config for eval runner)
  patterns:
    - Vitest-based eval runner consuming real SSE streams (pnpm eval script)
    - Independent sourceQuote re-verification (getCaptions + validateSourceQuotes in eval runner)
    - expectedResult:"either" mode for Shorts with unreliable captions
    - Explicit env-var resolution with throw-on-missing (replaces Redis.fromEnv() silent failure)
key_files:
  created:
    - tests/eval/run.eval.test.ts
    - tests/eval/short-chest-exercises.json
    - tests/eval/short-fitness-a.json
    - tests/eval/short-fitness-b.json
    - tests/eval/smoke.json
    - vitest.eval.config.ts
  modified:
    - vitest.config.ts
    - package.json
    - lib/redis/client.ts
    - app/api/cron/smoke/route.ts
key_decisions:
  - "3-video eval (all YouTube Shorts) instead of D-21's 9-video set: user-approved scope reduction; long-form eval deferred to Phase 3"
  - "expectedResult:'either' for Shorts: pipeline must not crash; schema validates if workout returned; graceful NO_WORKOUT equally valid"
  - "D-21c non-fitness control criterion UNCOVERED: no non-fitness video in this eval set; carry-forward to Phase 3"
  - "Vitest discovery fix: renamed run.ts -> run.eval.test.ts, added vitest.eval.config.ts, excluded *.eval.test.ts from default vitest.config.ts"
  - "Redis client explicit env-var fix: Redis.fromEnv() silently returned broken client on empty-string env vars; replaced with explicit resolution + throw-on-missing"
  - "Vercel Sensitive flag carry-forward: KV_REST_API_TOKEN/URL marked Sensitive by Vercel, vercel env pull returns empty strings; manual paste from console.upstash.com required"
patterns-established:
  - "Eval runner as Vitest describe/it suite (not a bare Node script) — gains timeout handling, exit codes, and test isolation"
  - "Redis client pattern: explicit env-var resolution, throw-on-missing, no silent failures"
requirements-completed:
  - EXTR-04
  - OPS-05
duration: 45min
completed: "2026-05-18"
---

# Phase 02 Plan 06: Eval Runner + Binary Gate Summary

**3-video Vitest eval runner for YouTube Shorts exercising the real /api/extract pipeline: WorkoutSchema validation, independent sourceQuote re-verification via getCaptions(), and pipeline crash detection — pnpm eval exits 0 confirmed (39s cold, 3.25s warm cache hit); mid-flight fixes for Vitest discovery and Redis client silent failures committed.**

## Performance

- **Duration:** ~45 min (including cold + warm eval runs)
- **Started:** 2026-05-18
- **Completed:** 2026-05-18
- **Tasks:** 2 of 2 (Task 1 auto + Task 2 human-verify approved)
- **Files modified:** 10

## Accomplishments

- Built `tests/eval/run.eval.test.ts` Vitest eval runner with independent sourceQuote re-verification (getCaptions + validateSourceQuotes per D-21c checker requirement); prints required "Independently verified sourceQuotes for N exercises across M videos" line before exit
- `pnpm eval` binary gate passed: 3 YouTube Shorts, exits 0, 39s cold run (real Gemini API calls), 3.25s warm run (Redis videoId cache hits confirmed working)
- Redis client rewritten: explicit env-var resolution with `throw` on missing, eliminating silent broken-client path caused by Vercel's Sensitive env-var flag stripping values during `vercel env pull`
- Vitest discovery fixed: renamed to `.eval.test.ts`, added `vitest.eval.config.ts`, excluded `*.eval.test.ts` from default `pnpm test` run so the eval never runs accidentally against a dev server

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Eval fixtures + runner + smoke.json | `7d2c526` | feat |
| mid-flight | Vitest discovery fix + Redis client KV_* fallback | `7b82448` | fix |
| 2 | Human-verify: pnpm eval exits 0 (APPROVED) | — | checkpoint |

**Prior plan metadata:** `1894591` (docs: checkpoint at Task 2, pre-finalization)

## Eval Results (Task 2 — Human-Approved 2026-05-18)

| Video | Slug | Expected | Result | Notes |
|-------|------|----------|--------|-------|
| Short 1 | `short-chest-exercises` | either | PASS | Schema valid |
| Short 2 | `short-fitness-a` | either | PASS | Schema valid |
| Short 3 | `short-fitness-b` | either | PASS | Schema valid |

- **Cold run:** 39s — real Gemini API calls
- **Warm run:** 3.25s — Redis videoId cache hits confirmed
- **Redis warnings in dev logs:** None (post Redis client fix)
- **D-21c sourceQuote independent re-verification:** Ran for each workout result; 0 dropped exercises

## Files Created/Modified

- `tests/eval/run.eval.test.ts` — Eval runner (Vitest suite); loads fixtures, POSTs to /api/extract, validates WorkoutSchema, re-verifies sourceQuotes via getCaptions()
- `tests/eval/short-chest-exercises.json` — Fixture: YouTube Short videoId `crcHvDs-YoU`, expectedResult: "either"
- `tests/eval/short-fitness-a.json` — Fixture: YouTube Short videoId `9KfFJn-1R2w`, expectedResult: "either"
- `tests/eval/short-fitness-b.json` — Fixture: YouTube Short videoId `tUeSiRch1y4`, expectedResult: "either"
- `tests/eval/smoke.json` — Updated from Rick Astley placeholder to real fitness Short with min/max exercise count range
- `vitest.eval.config.ts` — Separate Vitest config for eval (60s timeout, include: `*.eval.test.ts`)
- `vitest.config.ts` — Added `**/*.eval.test.ts` to exclude list so `pnpm test` never runs eval runner
- `package.json` — Updated eval script: `vitest run --config vitest.eval.config.ts tests/eval/run.eval.test.ts`
- `lib/redis/client.ts` — Rewrote to explicit `url`/`token` resolution with `throw` on missing; removed `Redis.fromEnv()` silent-failure path
- `app/api/cron/smoke/route.ts` — Updated to handle both legacy `expectedExerciseCount` and new `expectedExerciseCountMin`/`Max` shapes (Rule 1 fix from Task 1)

## Decisions Made

**1. 3-video eval instead of D-21's 9-video set (user-approved)**
All 3 selected videos are YouTube Shorts. D-21b's 9-slot coverage is not achieved. Accepted: fastest path to binary gate passing; full eval deferred to Phase 3.

**2. `expectedResult: "either"` for Shorts**
YouTube Shorts may or may not have captions. Forcing `expectedResult: "workout"` would make the gate fragile. "Either" mode: pipeline must not crash; schema validates if workout returned; graceful NO_WORKOUT is equally valid.

**3. D-21c non-fitness control criterion UNCOVERED**
No non-fitness video in this eval set. The NO_WORKOUT code path cannot be exercised here. Phase 3 must add a cooking/vlog/gaming video that MUST return NO_WORKOUT before production traffic is enabled.

**4. Vitest runner vs tsx script**
`tsx` is not installed; the runner uses vitest (already installed), gaining timeout handling, proper exit codes, and test isolation.

## Deviations from Plan

### Scope Reduction (User-Approved)

**1. 3 YouTube Shorts instead of 9 D-21b slots**

| Item | D-21b Canonical | This Eval (Plan 02-06) |
|------|----------------|------------------------|
| Video count | 9 (8 fitness + 1 non-fitness) | 3 (all fitness Shorts) |
| Non-fitness control | Yes — must return NO_WORKOUT | Absent |
| D-21c coverage | 100% sourceQuote + recall + NO_WORKOUT | sourceQuote + recall (NO_WORKOUT not exercised) |
| D-21b slot coverage | All 8 slots | 0 of 8 (all are YouTube Shorts) |

### Auto-Fixed Issues

**2. [Rule 1 - Bug] Vitest discovery fix**
- **Found during:** Task 1 verification (pnpm eval was silently passing with 0 tests run)
- **Issue:** `run.ts` not matched by Vitest's default include pattern (`**/*.{test,spec}.*`)
- **Fix:** Renamed to `run.eval.test.ts`; added `vitest.eval.config.ts`; excluded from `vitest.config.ts`
- **Files modified:** `tests/eval/run.eval.test.ts`, `vitest.eval.config.ts`, `vitest.config.ts`, `package.json`
- **Committed in:** `7b82448`

**3. [Rule 1 - Bug] Redis client silent failure on missing env vars**
- **Found during:** Task 2 (Redis warnings visible in dev logs during eval run)
- **Issue:** `Redis.fromEnv()` returned a broken client instead of throwing when KV_* vars were empty strings (Vercel marks TOKEN/KEY/SECRET vars as Sensitive, so `vercel env pull` retrieves them as empty strings)
- **Fix:** Rewrote `lib/redis/client.ts` to explicit `url`/`token` resolution with `throw new Error(...)` on missing
- **Files modified:** `lib/redis/client.ts`
- **Committed in:** `7b82448`

**4. [Rule 1 - Bug] smoke cron handler incompatible with updated smoke.json shape**
- **Found during:** Task 1 (smoke.json shape update)
- **Issue:** `app/api/cron/smoke/route.ts` typed to `{ videoId: string; expectedExerciseCount: number }` (singular) but new smoke.json has `expectedExerciseCountMin`/`Max`. TypeScript error TS2352.
- **Fix:** Updated cron handler to accept both legacy and new shapes; derives `expectedMin`/`expectedMax` from whichever is present; uses `videoUrl` from fixture for Shorts URL format
- **Files modified:** `app/api/cron/smoke/route.ts`
- **Committed in:** `7d2c526` (Task 1 commit)

---

**Total deviations:** 1 scope reduction (user-approved) + 3 auto-fixed bugs
**Impact on plan:** Scope reduction creates known gaps addressed in Phase 3 carry-forwards. All three auto-fixes correct silent failure modes.

## Phase 3 Carry-Forwards

| Item | Priority | Notes |
|------|----------|-------|
| D-21c non-fitness control UNCOVERED | High | A cooking/vlog/gaming video MUST return NO_WORKOUT. Not tested in this eval. Must add before EXTRACT_MODE=real production traffic. |
| 9-video eval deferred | Medium | D-21b's full slot coverage (dumbbell, barbell, HIIT, calisthenics, yoga, superset, long-format, minimalist) not represented. Phase 3 should expand to long-form fitness videos as the product's primary target. |
| Shorts-only eval not representative | Medium | The 3 fixtures are YouTube Shorts — product targets long-form workout videos (15-60 min). Caption density and exercise extraction complexity differ significantly. |

## Vercel Sensitive Flag — Wave 6 Carry-Forward

Vercel auto-marks env vars containing TOKEN/KEY/SECRET as Sensitive. `vercel env pull` retrieves Sensitive vars as empty strings rather than real values. Affected vars:

- `KV_REST_API_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`
- `OPENAI_API_KEY`, `RESEND_API_KEY`, `GITHUB_TOKEN`, `CRON_SECRET`

**Decision required in Plan 02-07:** Either (a) mark these vars non-Sensitive in Vercel dashboard so `vercel env pull` works, OR (b) maintain `.env.local` with manually-pasted values from Upstash/OpenAI/GitHub dashboards. Both are acceptable; (a) is more convenient for CI; (b) keeps sensitive values out of Vercel's Sensitive-flag flow.

**Current workaround:** User manually pasted real Upstash credentials from console.upstash.com into `.env.local`. The Redis client now throws immediately on startup if credentials are missing, surfacing this as a startup error rather than a runtime Redis failure.

## Known Stubs

**`tests/eval/smoke.json`** — Uses a YouTube Short as the smoke target. Shorts have unreliable captions, meaning the daily smoke cron may correctly return NO_WORKOUT rather than a real extraction — which makes the cron useless as a quality signal. Replace with a long-form fitness video (CC enabled) before the daily cron is relied upon for production quality monitoring.

## Issues Encountered

None beyond the auto-fixes documented above.

## Threat Flags

No new threat surface. T-02-06-01 (eval consuming rate limit quota during testing) and T-02-06-02 (fixture URLs in repo) both accepted per plan threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `tests/eval/run.eval.test.ts` | FOUND |
| `tests/eval/short-chest-exercises.json` | FOUND |
| `tests/eval/short-fitness-a.json` | FOUND |
| `tests/eval/short-fitness-b.json` | FOUND |
| `tests/eval/smoke.json` | FOUND (updated) |
| `vitest.eval.config.ts` | FOUND |
| `vitest.config.ts` (exclude entry for *.eval.test.ts) | FOUND |
| `lib/redis/client.ts` (explicit env-var resolution) | FOUND |
| Commit `7d2c526` (Task 1 — eval fixtures + runner) | FOUND |
| Commit `7b82448` (mid-flight fixes: Vitest discovery + Redis client) | FOUND |
| Task 2 human-verify: pnpm eval exits 0 | APPROVED 2026-05-18 |

**Plan 02-06 complete** — binary gate passed, mid-flight fixes committed, Phase 3 carry-forwards documented.
