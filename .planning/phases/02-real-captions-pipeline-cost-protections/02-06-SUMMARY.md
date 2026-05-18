---
phase: "02"
plan: "06"
subsystem: testing
tags:
  - eval-runner
  - d21-binary-gate
  - source-quote-verification
  - youtube-shorts
  - vitest
dependency_graph:
  requires:
    - 02-04  # RealExtractionService (getCaptions + validateSourceQuotes)
    - 02-05  # smoke.json placeholder + cron handler
  provides:
    - EXTR-04  # Eval gate — binary pass criteria before real pipeline ship
    - OPS-05   # smoke.json updated to real fixture shape
  affects:
    - tests/eval/run.ts
    - tests/eval/smoke.json
    - app/api/cron/smoke/route.ts
tech_stack:
  added: []
  patterns:
    - Vitest-based eval runner consuming real SSE streams (pnpm eval script)
    - Independent sourceQuote re-verification (getCaptions + validateSourceQuotes in eval runner, not trusting server-side guard)
    - expectedResult:"either" mode for Shorts with unreliable captions
key_files:
  created:
    - tests/eval/run.ts
    - tests/eval/short-chest-exercises.json
    - tests/eval/short-fitness-a.json
    - tests/eval/short-fitness-b.json
  modified:
    - tests/eval/smoke.json
    - package.json
    - app/api/cron/smoke/route.ts
key_decisions:
  - "Scope reduction (user-approved): 3 YouTube Shorts instead of 9 D-21b slots — all fitness, no non-fitness control. D-21c NO_WORKOUT criterion is uncovered; documented as Phase 3 carry-forward."
  - "expectedResult:'either' mode for Shorts — caption availability is unreliable on Shorts; both valid extraction and graceful NO_WORKOUT are acceptable outcomes."
  - "smoke.json updated to expectedExerciseCountMin/Max shape; annotated that a long-form video is needed before the daily cron is meaningful."
  - "smoke cron handler (Rule 1 fix) updated to support both legacy single-value and new min/max range shapes for exercise count validation."
requirements-completed:
  - EXTR-04
  - OPS-05
duration: 20min
completed: "2026-05-18"
---

# Phase 02 Plan 06: Eval Runner + Binary Gate Summary

**D-21 eval runner with independent sourceQuote re-verification (getCaptions + validateSourceQuotes) for 3 YouTube Shorts; checkpoint awaiting pnpm eval run against real Gemini pipeline.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-18T04:30:00Z
- **Completed:** 2026-05-18 (Task 1 complete; checkpoint at Task 2)
- **Tasks:** 1 of 2 auto tasks complete (Task 2 = checkpoint:human-verify, awaiting human)
- **Files modified:** 7

## Accomplishments

- Built `tests/eval/run.ts` vitest-based eval runner with:
  - Independent caption re-fetch via `getCaptions()` and `validateSourceQuotes()` per D-21c
  - Prints "Independently verified sourceQuotes for N exercises across M videos" before exit
  - Binary failure on schema invalidity, crash, or dropped sourceQuotes
  - `expectedResult: "either"` mode for Shorts (both workout extraction and NO_WORKOUT are acceptable)
  - 60s per-video timeout for SSE stream consumption
  - Summary table with per-video PASS/FAIL/SKIP status
- Created 3 eval fixture JSONs for the 3 user-provided YouTube Shorts
- Updated `smoke.json` from Rick Astley placeholder to real fitness Short with min/max range shape
- Fixed `app/api/cron/smoke/route.ts` to handle the new smoke.json shape (Rule 1)
- Added `"eval": "EXTRACT_MODE=real vitest run tests/eval/run.ts"` to package.json

## Task Commits

1. **Task 1: Eval fixtures + eval runner + smoke.json** - `7d2c526` (feat)

## Files Created/Modified

- `tests/eval/run.ts` — D-21 binary gate eval runner; imports getCaptions + validateSourceQuotes; independent sourceQuote verification
- `tests/eval/short-chest-exercises.json` — fixture for videoId `crcHvDs-YoU` (YouTube Short, expectedResult: "either")
- `tests/eval/short-fitness-a.json` — fixture for videoId `9KfFJn-1R2w` (YouTube Short, expectedResult: "either")
- `tests/eval/short-fitness-b.json` — fixture for videoId `tUeSiRch1y4` (YouTube Short, expectedResult: "either")
- `tests/eval/smoke.json` — updated from placeholder to real fitness Short; min/max exercise count shape; annotated as needing long-form replacement
- `package.json` — added `"eval"` script
- `app/api/cron/smoke/route.ts` — updated to handle both legacy `expectedExerciseCount` and new `expectedExerciseCountMin`/`Max` shapes; uses `videoUrl` from fixture

## Decisions Made

- **Scope reduction (user-approved):** 3 YouTube Shorts instead of the canonical 9-video eval set (D-21b). All 3 are fitness Shorts (no non-fitness control). This means:
  - D-21c non-fitness control criterion (`NO_WORKOUT` for non-fitness) is uncovered by this eval
  - D-21b slots 1-8 (dumbbell, barbell, HIIT, calisthenics, yoga, superset, long-format, minimalist) are not represented
  - Accepted deviation per orchestrator note — Phase 3 carry-forward documented below
- **`expectedResult: "either"` mode:** YouTube Shorts frequently lack CC captions, meaning the pipeline will correctly return `NO_WORKOUT` via the caption-null path. The eval runner treats both outcomes as valid for Shorts.
- **Vitest runner vs tsx script:** `tsx` is not installed in the project; the runner uses vitest (already installed), which provides test isolation, timeout handling, and proper exit codes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] smoke cron handler incompatible with updated smoke.json shape**
- **Found during:** Task 1 (smoke.json update)
- **Issue:** `app/api/cron/smoke/route.ts` was typed to `{ videoId: string; expectedExerciseCount: number }` (singular) but the new smoke.json has `expectedExerciseCountMin`/`expectedExerciseCountMax`. TypeScript reported an error (TS2352).
- **Fix:** Updated the cron handler to accept both legacy and new shapes; derives `expectedMin`/`expectedMax` from whichever is present; uses `videoUrl` from fixture for Shorts URL format support.
- **Files modified:** `app/api/cron/smoke/route.ts`
- **Verification:** `pnpm typecheck` exits 0 after fix.
- **Committed in:** `7d2c526` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix. No scope creep.

### Scope Reduction (User-Approved, Documented)

Per orchestrator note (user-approved before execution):

| Item | D-21b Canonical | This Eval (Plan 02-06) |
|------|----------------|------------------------|
| Video count | 9 (8 fitness + 1 non-fitness) | 3 (all fitness Shorts) |
| Non-fitness control | Yes — must return NO_WORKOUT | Absent |
| D-21c coverage | 100% sourceQuote + recall + NO_WORKOUT | sourceQuote + recall (NO_WORKOUT not exercised) |
| Slot coverage | All 8 D-21b slots | 0 of 8 (all are YouTube Shorts, not slot-specific) |

**Phase 3 carry-forward:**
- The non-fitness control test (D-21c) must be run against a proper non-fitness video before the production `EXTRACT_MODE=real` ship
- A full 9-video eval with long-form captioned videos should replace this Shorts eval in Phase 3
- The smoke cron needs a long-form fitness video (e.g., Jeff Nippard or AthleanX with CC) before the daily cron is meaningful — Shorts captions are unreliable

## Checkpoint Status (Task 2)

**Task 2 is a `checkpoint:human-verify` gate.** Execution stopped here.

The eval runner (`pnpm eval`) is ready to run but requires:
1. Local dev server running with `EXTRACT_MODE=real`
2. Gemini API key (`GOOGLE_GENERATIVE_AI_API_KEY` or equivalent) set in `.env.local`
3. Upstash Redis credentials in `.env.local`

See checkpoint message in executor output for exact instructions.

## Known Stubs

**`tests/eval/smoke.json`** — Uses YouTube Short `crcHvDs-YoU` as the smoke target. Shorts have unreliable captions, meaning the daily smoke cron will likely return NO_WORKOUT rather than a real extraction. This is technically "correct" behavior but makes the smoke test useless as an extraction quality signal. Replace with a long-form fitness video (with CC enabled) before the daily cron is relied upon for production quality monitoring.

## Issues Encountered

None beyond the Rule 1 auto-fix above.

## Threat Flags

No new threat surface. T-02-06-01 (eval consuming rate limit quota) and T-02-06-02 (fixture URLs in repo) both accepted per plan threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `tests/eval/run.ts` | FOUND |
| `tests/eval/short-chest-exercises.json` | FOUND |
| `tests/eval/short-fitness-a.json` | FOUND |
| `tests/eval/short-fitness-b.json` | FOUND |
| `tests/eval/smoke.json` | FOUND (updated) |
| Commit `7d2c526` (Task 1) | FOUND |
| `grep getCaptions tests/eval/run.ts` | 3 occurrences |
| `grep validateSourceQuotes tests/eval/run.ts` | 4 occurrences |
| `grep "Independently verified" tests/eval/run.ts` | 1 occurrence |
| `grep "process.exit(1)" tests/eval/run.ts` | 1 occurrence |
| `pnpm typecheck` | 0 errors |
| `package.json "eval" script` | FOUND |
| Task 2 checkpoint | AWAITING HUMAN VERIFICATION |
