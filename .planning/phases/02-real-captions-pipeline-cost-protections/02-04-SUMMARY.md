---
phase: 02-real-captions-pipeline-cost-protections
plan: 04
subsystem: api
tags: [sse, ratelimit, redis, youtube-captions, gemini, zod, nextjs, route-handlers]

# Dependency graph
requires:
  - phase: 02-real-captions-pipeline-cost-protections
    provides: checkRateLimit, checkSpendCap/incrementSpend, getCached/setCached/acquireLock/releaseLock, getCaptions, extractWorkout, validateSourceQuotes
provides:
  - RealExtractionService: full captions-first pipeline (getCaptions → extractWorkout → validateSourceQuotes → lowConfidence)
  - app/api/extract/route.ts: HTTP pre-flight (429/503) + SSE pipeline with cache stampede protection
  - ExtractEventSchema: SSE error.code narrowed to NETWORK|NO_WORKOUT|UNKNOWN; result type enriched with cached/lowConfidence
  - ExtractFlow.tsx: HTTP status-based pre-flight checks before SSE consumer; forwards lowConfidence/cached to success state
  - reducer.ts: BUDGET_EXHAUSTED in ErrorCode union; success state includes lowConfidence+cached fields
affects:
  - 02-05-PLAN (ConfidenceBanner uses lowConfidence; Cached badge uses cached)
  - 02-06-PLAN (eval set runs against RealExtractionService)
  - 02-07-PLAN (ship gate verifies entire pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HTTP-then-SSE sequence: pre-flight checks (429/503) return before SSE stream opens; in-flight errors emit as SSE events only
    - 4 D-23 low-confidence signals: extraction_confidence=low OR routine<3 OR wordCount<200 OR droppedCount>0
    - Cache stampede prevention: acquireLock → poll getCached × 30 (1s each) when lock not acquired
    - Mock-mode parity: route.ts intercepts rate-limit URL keyword and returns HTTP 429 in mock mode

key-files:
  created:
    - lib/extraction/real.ts (RealExtractionService replacing Phase 1 stub)
    - tests/real-extraction.test.ts (TDD tests for RealExtractionService)
    - tests/route-pipeline.test.ts (TDD tests for route.ts pipeline)
    - tests/extract-flow-preflight.test.ts (TDD tests for reducer BUDGET_EXHAUSTED + success state enrichment)
  modified:
    - lib/schema/workout.ts (SSE error enum narrowed; result type enriched)
    - lib/extraction/mock.ts (rate-limit keyword falls through; comment updated)
    - lib/youtube/url.ts (getClientIp() added)
    - app/api/extract/route.ts (full rewrite with HTTP pre-flight + SSE pipeline)
    - components/extract/reducer.ts (BUDGET_EXHAUSTED, lowConfidence, cached in success state)
    - components/extract/ErrorState.tsx (BUDGET_EXHAUSTED variant added)
    - components/extract/ExtractFlow.tsx (HTTP pre-flight status checks; lowConfidence/cached forwarding)
    - tests/url-keyword-routing.test.ts (rate-limit test updated to reflect HTTP 429 architecture)

key-decisions:
  - "SSE error.code enum narrowed to NETWORK|NO_WORKOUT|UNKNOWN — RATE_LIMITED and BUDGET_EXHAUSTED are HTTP-only (429/503 before SSE stream)"
  - "RealExtractionService is a pure extraction pipeline — no Redis interaction; cache/rate-limit are route.ts concerns"
  - "4 D-23 low-confidence signals computed in RealExtractionService; result event carries lowConfidence: boolean"
  - "getClientIp() added to lib/youtube/url.ts (co-located with URL utilities; RESEARCH Pattern 2)"
  - "Mock mode rate-limit keyword intercepted at route.ts level (before extraction service) for mock parity with real"
  - "Cache stampede: if lock not acquired, poll getCached × 30 (1s apart); fall through to own extraction if still no result after 30s"
  - "releaseLock called in finally-equivalent logic after result event; also in error cleanup path"

patterns-established:
  - "HTTP pre-flight pattern: check non-streaming guards first (rate limit → spend cap) before opening SSE stream"
  - "SSE result enrichment: route.ts enriches result with cached and lowConfidence before emitting to client"
  - "Reducer success state enrichment: success action carries optional lowConfidence/cached fields; defaults to false"

requirements-completed: [EXTR-01, EXTR-02, EXTR-03, COST-01, COST-02, COST-03]

# Metrics
duration: ~68min
completed: 2026-05-18
---

# Phase 2 Plan 04: Wire Real Extraction Pipeline Summary

**Captions-first real extraction pipeline wired end-to-end: HTTP pre-flight (429/503) → cache → LLM → sourceQuote guard → SSE result with lowConfidence and cached fields**

## Performance

- **Duration:** ~68 min
- **Started:** 2026-05-18T02:30:00Z
- **Completed:** 2026-05-18T03:40:01Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 10

## Accomplishments

- RealExtractionService fully implemented: getCaptions → extractWorkout → validateSourceQuotes → 4-stage SSE pipeline with 4 D-23 low-confidence signals
- route.ts rewritten: HTTP pre-flight rate-limit (429) and spend cap (503) checks return before SSE stream opens; cache hit returns immediately with cached:true; stampede lock prevents concurrent LLM calls for same videoId
- ExtractFlow.tsx updated: checks response.status before SSE consumer (429 → RATE_LIMITED, 503 → BUDGET_EXHAUSTED, 200 → SSE); forwards lowConfidence and cached from result event to success state

## Task Commits

Each task was committed atomically:

1. **Task 1: RealExtractionService + schema SSE error enum narrowing** - `5bfebcd` (feat)
2. **Task 2: Route.ts HTTP pre-flight + SSE pipeline orchestration** - `c7cc1d1` (feat)
3. **Task 3: ExtractFlow.tsx pre-flight handling + reducer enrichment** - `41085b5` (feat)

**Plan metadata:** (docs commit — see below)

_All 3 tasks were TDD with RED→GREEN commit pattern._

## Files Created/Modified

- `lib/schema/workout.ts` — SSE error.code enum narrowed to NETWORK|NO_WORKOUT|UNKNOWN; result type adds cached and lowConfidence optional fields
- `lib/extraction/real.ts` — Full RealExtractionService replacing Phase 1 stub; pure extraction pipeline with 4 D-23 low-confidence signals
- `lib/extraction/mock.ts` — rate-limit keyword no longer emits SSE RATE_LIMITED event (falls through to normal extraction; HTTP 429 handled at route level)
- `lib/youtube/url.ts` — Added getClientIp(req) helper reading x-forwarded-for / x-real-ip headers
- `app/api/extract/route.ts` — Full rewrite implementing HTTP-then-SSE sequence with all cost protections
- `components/extract/reducer.ts` — BUDGET_EXHAUSTED added to ErrorCode union; success state enriched with lowConfidence and cached fields
- `components/extract/ErrorState.tsx` — BUDGET_EXHAUSTED variant added to ErrorCode type and ERROR_CONFIG
- `components/extract/ExtractFlow.tsx` — HTTP status checks before SSE consumer; lowConfidence/cached forwarded to success dispatch
- `tests/real-extraction.test.ts` — TDD tests for RealExtractionService (12 tests)
- `tests/route-pipeline.test.ts` — TDD tests for route.ts pipeline (24 tests)
- `tests/extract-flow-preflight.test.ts` — TDD tests for reducer enrichment (7 tests)
- `tests/url-keyword-routing.test.ts` — Updated rate-limit keyword test to reflect HTTP 429 architecture

## Decisions Made

- SSE error.code enum is exactly `["NETWORK", "NO_WORKOUT", "UNKNOWN"]` — RATE_LIMITED and BUDGET_EXHAUSTED are HTTP-only responses (429/503), not SSE events. ExtractFlow.tsx handles them via `response.status` check, not SSE parsing.
- RealExtractionService does NOT interact with Redis — cache reads/writes and rate-limit/spend checks are route.ts concerns, keeping the service a pure extraction pipeline.
- Mock mode rate-limit keyword interception is at route.ts level (before calling extraction service), not in MockExtractionService — ensures mock exercises same HTTP 429 path that real clients see.
- Cache stampede: poll getCached × 30 (1s apart) when lock not acquired — falls through to own extraction after 30s timeout (defensive fallback if lock holder fails).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MockExtractionService TypeScript error after SSE enum narrowing**
- **Found during:** Task 1 (after narrowing SSE error.code enum)
- **Issue:** `mock.ts` still used `code: "RATE_LIMITED"` which TypeScript rejected after removing RATE_LIMITED from the SSE enum
- **Fix:** Replaced the rate-limit keyword branch in MockExtractionService with a comment explaining the architectural change (HTTP 429 from route.ts, not SSE from service); rate-limit URL keyword now falls through to normal extraction at the service level
- **Files modified:** `lib/extraction/mock.ts`, `tests/url-keyword-routing.test.ts`
- **Committed in:** `5bfebcd` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript compatibility bug from schema change)
**Impact on plan:** Necessary consequence of the SSE enum narrowing; no scope creep.

## Issues Encountered

- SSE stream consumption: route.ts tests initially failed because the async extraction generators only run when the ReadableStream is consumed (lazy evaluation). Fixed by calling `readSSEStream(response)` in tests that verify side effects (incrementSpend, setCached, releaseLock). This is correct behavior — the stream must be consumed to trigger the extraction work.

## Known Stubs

None — all fields wired to real data sources. `cached` and `lowConfidence` fields are computed from real signals, not placeholders.

## Threat Flags

None — threat surface matches the `<threat_model>` in the plan. Rate-limit check at step 2 (T-02-04-01), spend cap at step 3 (T-02-04-02), stampede lock (T-02-04-04). No new endpoints or auth paths introduced.

## Next Phase Readiness

- Plan 02-05 (ConfidenceBanner + Cached badge): `lowConfidence` and `cached` fields are now in success state — WorkoutView can render them directly
- Plan 02-06 (eval set): RealExtractionService is ready for fixture-based evaluation against real captions
- Plan 02-07 (ship gate): Full pipeline works end-to-end; flip EXTRACT_MODE=real to enable

## Self-Check

- [x] `lib/extraction/real.ts` exists and exports RealExtractionService
- [x] `app/api/extract/route.ts` contains checkRateLimit, checkSpendCap, getCached
- [x] `lib/schema/workout.ts` SSE error.code enum is exactly NETWORK|NO_WORKOUT|UNKNOWN
- [x] `components/extract/ExtractFlow.tsx` contains 429 check
- [x] All 215 tests pass
- [x] `pnpm typecheck` exits 0
- [x] `pnpm build` compiles successfully

## Self-Check: PASSED

---
*Phase: 02-real-captions-pipeline-cost-protections*
*Completed: 2026-05-18*
