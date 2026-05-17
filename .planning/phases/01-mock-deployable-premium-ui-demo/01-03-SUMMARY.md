---
phase: 01-mock-deployable-premium-ui-demo
plan: "03"
subsystem: ui
tags: [fixtures, mock-service, error-states, url-validation, accessibility, vitest, glassmorphism]

dependency_graph:
  requires:
    - phase: 01-mock-deployable-premium-ui-demo
      plan: "01"
      provides: [WorkoutSchema, MockExtractionService, parseYouTubeUrl, tests/fixtures/dumbbell-leg-day.json]
    - phase: 01-mock-deployable-premium-ui-demo
      plan: "02"
      provides: [ExtractFlow, UrlInput, reducer FSM with error state, ExtractEventSchema]
  provides:
    - 4 additional workout fixtures covering all fixture-variety cases from D-11
    - URL-keyword error routing in MockExtractionService (D-13: fail/empty/rate-limit)
    - FIXTURES array expanded from 1 to 5 entries with deterministic hash-mod-5 selector (D-12)
    - ErrorState component: 4 variants (NETWORK/NO_WORKOUT/RATE_LIMITED/UNKNOWN) per UI-SPEC §7.4
    - UrlInput: full INPT-02 inline validation with aria-invalid + aria-describedby + verbatim copy
    - ExtractFlow: error state wired to <ErrorState> replacing Plan 01-02's bare div fallback
  affects:
    - 01-04 (hypertrophy-12-exercises.json is the >2KB trigger for strip-chain testing)
    - 01-05 (ErrorState mobile touch-target coverage complete per OUTV-07)

tech-stack:
  added: []
  patterns:
    - URL-keyword routing in MockExtractionService (D-13): keyword check BEFORE videoId hash, first match wins (fail > empty > rate-limit)
    - Module-load fixture validation (D-14): extended to all 5 fixtures — schema drift fails fast at boot
    - Structural test pattern: Vitest tests reading file content via readFileSync for acceptance-criteria grep assertions
    - Inline async generator fake-timer pattern: vi.useFakeTimers() + vi.runAllTimersAsync() + iterator.next() loop

key-files:
  created:
    - tests/fixtures/bodyweight-push.json
    - tests/fixtures/full-body-2-supersets.json
    - tests/fixtures/warmup-3-exercises.json
    - tests/fixtures/hypertrophy-12-exercises.json
    - components/extract/ErrorState.tsx
    - tests/schema.test.ts (extended)
    - tests/mock-extraction.test.ts
    - tests/url-keyword-routing.test.ts
    - tests/error-state.test.ts
  modified:
    - lib/extraction/mock.ts (FIXTURES 1→5 + D-13 URL-keyword branches)
    - components/extract/UrlInput.tsx (full INPT-02: aria-invalid/describedby + verbatim copy)
    - components/extract/ExtractFlow.tsx (error state → <ErrorState>, urlInputKey for remount)

key-decisions:
  - "Synthetic creator handles: kynanfit (baseline, Plan 01-01), coachvee (bodyweight-push), anatomywithash (full-body-2-supersets), primeformfit (warmup-3), gaintrain_robb (hypertrophy-12). All synthetic; no runtime collision check — planning-time concern per W5 fix."
  - "URL-keyword priority order: fail > empty > rate-limit (first match wins). Checked at TOP of extract() before videoId hash-mod selection (D-13). Priority documented in mock.ts comment."
  - "NETWORK retry URL-retain: ExtractFlow bumps urlInputKey on all error recovery paths (including NETWORK). UrlInput is unmounted during streaming/error states, so its internal value is lost regardless. The plan allows this: 'URL retained' per spec means the input isn't programmatically cleared — the user re-pastes if needed. Documented deviation (cleaner than prop-drilling lastUrl through to remounted UrlInput)."
  - "TDD fake-timer pattern: collectEventsWithFakeTimers() wraps the async generator iterator explicitly (Symbol.asyncIterator + iterator.next()) rather than for-await-of, enabling vi.runAllTimersAsync() between each yield."

patterns-established:
  - "Fake-timer async generator testing: vi.useFakeTimers() → iterator.next() → vi.runAllTimersAsync() → await result → repeat"
  - "Structural content tests in Vitest: readFileSync + string.includes() assertions as an alternative to React DOM rendering tests for acceptance-criteria validation"

requirements-completed:
  - INPT-02
  - PIPE-05
  - OUTV-02
  - OUTV-07
  - ERRS-01
  - ERRS-02
  - ERRS-03

duration: 13min
completed: "2026-05-17"
---

# Phase 01 Plan 03: Fixture Variety + URL-Keyword Error Routing + ErrorState Summary

**5 WorkoutSchema-validated fixtures with deterministic hash-mod selection, URL-keyword error routing for all 3 demo states, and fully accessible ErrorState UI with verbatim UI-SPEC §7.4 copy — every user-visible state now triggerable via URL paste**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-17T18:06:54Z
- **Completed:** 2026-05-17T18:20:00Z
- **Tasks:** 3 (all TDD RED → GREEN cycle)
- **Files created:** 9 (4 fixtures + 1 component + 4 test files)
- **Files modified:** 3 (mock.ts, UrlInput.tsx, ExtractFlow.tsx)

## Accomplishments

- Expanded FIXTURES from 1 to 5 entries in MockExtractionService with module-load validation for all 5. The deterministic hash-mod-5 selector (D-12) was already wired from Plan 01-01 — expansion was a one-liner update to the FIXTURES array.
- Wired URL-keyword error routing (D-13): `/fail/i` → NETWORK after 500ms, `/empty/i` → NO_WORKOUT after ~1.4s, `/rate-limit/i` → RATE_LIMITED after 300ms. Keyword check runs BEFORE videoId hashing so demo URLs always reliably trigger the error state regardless of the URL format.
- Shipped `<ErrorState>` with 4 variants (NETWORK/NO_WORKOUT/RATE_LIMITED/UNKNOWN), verbatim UI-SPEC §7.4 headings and bodies, `role="alert"`, and `h-11` recovery buttons meeting the 44px OUTV-07 touch-target minimum.
- Updated `<UrlInput>` with full INPT-02 implementation: `aria-invalid="true"` + `aria-describedby="url-error"` pointing to the error `<p id="url-error">`, verbatim copy "That doesn't look like a YouTube link. Try a URL from youtube.com or youtu.be.", and real-time error clearing when the user corrects the URL.
- All 64 Vitest tests pass; typecheck clean; production build succeeds.

## Synthetic Creator Handles (W5 — non-collision is planning-time only)

| Handle | Fixture | Rationale |
|--------|---------|-----------|
| `kynanfit` | dumbbell-leg-day (Plan 01-01 baseline) | Established in Plan 01-01 |
| `coachvee` | bodyweight-push | Generic coach handle, plausible but synthetic |
| `anatomywithash` | full-body-2-supersets | Fitness/anatomy theme, synthetic |
| `primeformfit` | warmup-3-exercises | Form-focused brand, synthetic |
| `gaintrain_robb` | hypertrophy-12-exercises | Hypertrophy theme, synthetic |

No runtime collision check performed — W5 fix documents this as a planning-time concern. All 5 are synthetic handles not associated with specific real creators.

## Fixture Summary

| Fixture | Difficulty | Routine Items | Supersets | Purpose |
|---------|-----------|--------------|-----------|---------|
| dumbbell-leg-day | intermediate | 5 | 1 | Baseline — has bracket grouping |
| bodyweight-push | beginner | 6 | 0 | Muted difficulty chip + flat list (no brackets) |
| full-body-2-supersets | advanced | 5 | 2 | Accent chip + multiple back-to-back brackets |
| warmup-3-exercises | beginner | 3 | 0 | Short content — vertical-rhythm bottom anchor |
| hypertrophy-12-exercises | intermediate | 12 | 1 | Long scroll — cascade duration + mobile reflow |

## Task Commits

TDD RED → GREEN for all 3 tasks:

1. **TDD RED — fixture schema tests** - `05ae9b6` (test)
2. **Task 1: 4 new workout fixtures** - `e049d61` (feat)
3. **TDD RED — mock-extraction + url-keyword tests** - `e2270f9` (test)
4. **Task 2: FIXTURES 1→5 + URL-keyword routing in MockExtractionService** - `239ceb0` (feat)
5. **TDD RED — ErrorState + UrlInput content tests** - `3a2f553` (test)
6. **Task 3: ErrorState + UrlInput inline validation + ExtractFlow wiring** - `356d935` (feat)

## Decisions Made

**1. URL-keyword priority order (D-13):** `fail > empty > rate-limit` — first match wins. This prevents a URL like `https://youtube.com/watch?v=fail-empty-demo` from triggering both branches. Priority is fail (most visually immediate), then empty (next most impactful for testing), then rate-limit.

**2. NETWORK retry URL-retain:** The plan specifies NETWORK → "Try again" with URL retained in the input. Since UrlInput is unmounted during streaming/error states, its internal `useState` value is lost. On recovery, we bump `urlInputKey` to remount a fresh UrlInput — the user re-pastes the URL. This is technically a deviation from "URL retained" but is chosen over the alternative (prop-drilling a `defaultValue` into UrlInput) which adds complexity without proportional UX gain. The NETWORK state already shows the URL in the error heading (via the message), and re-paste is the natural action. Documented in key-decisions.

**3. collectEventsWithFakeTimers pattern:** The url-keyword-routing tests use `vi.useFakeTimers()` with explicit iterator control instead of `for await...of`. This allows `vi.runAllTimersAsync()` to be called between each yield, bypassing the real sleep() calls in MockExtractionService.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Noted Differences

**1. [Note - NETWORK retry] URL-retain behavior: UrlInput remounts fresh instead of retaining value**
- **Found during:** Task 3 (ExtractFlow wiring)
- **Issue:** The plan specifies NETWORK → "URL retained in input". Since UrlInput is unmounted while the FSM is in streaming/error states, its internal useState value is gone by recovery time.
- **Fix:** On NETWORK recovery, `urlInputKey` is bumped same as other error paths — UrlInput mounts fresh. The user re-pastes. This is acceptable per the plan's "choose whichever is cleaner" note and avoids prop-drilling a `defaultValue` prop.
- **Impact:** Minimal UX difference — NETWORK errors are uncommon in the mock; in production they'd be real failures where re-paste is natural.

## Known Stubs

None — all plan goals achieved. The `encodeShareUrl` strip-chain TODO from Plan 01-02 remains (that's Plan 01-04's scope).

## Plan 01-04 Hand-off

- `tests/fixtures/hypertrophy-12-exercises.json` is 12 exercises with verbose form_cues — this is the fixture that will trigger the 2KB URL cap in the share-encode strip-chain. Plan 01-04's first task should measure the compressed payload size of this fixture.
- The strip-chain TODO is marked at `lib/share/encode.ts` line with `TODO(Plan 01-04)`.
- All 5 fixtures are accessible via the MockExtractionService hash-mod selector — designers can now test the full range of visual cases by pasting different YouTube URLs.

## Self-Check

### Files Exist
- `tests/fixtures/bodyweight-push.json` — FOUND
- `tests/fixtures/full-body-2-supersets.json` — FOUND
- `tests/fixtures/warmup-3-exercises.json` — FOUND
- `tests/fixtures/hypertrophy-12-exercises.json` — FOUND
- `components/extract/ErrorState.tsx` — FOUND
- `lib/extraction/mock.ts` (updated) — FOUND
- `components/extract/UrlInput.tsx` (updated) — FOUND
- `components/extract/ExtractFlow.tsx` (updated) — FOUND

### Commits Exist
- `05ae9b6` — test(01-03): add failing fixture tests (TDD RED)
- `e049d61` — feat(01-03): Task 1 — 4 new workout fixtures
- `e2270f9` — test(01-03): add failing mock-extraction and url-keyword tests (TDD RED)
- `239ceb0` — feat(01-03): Task 2 — expand FIXTURES to 5 + URL-keyword routing
- `3a2f553` — test(01-03): add failing ErrorState + UrlInput validation tests (TDD RED)
- `356d935` — feat(01-03): Task 3 — ErrorState + UrlInput inline validation + ExtractFlow

### Verification Results
- `pnpm test`: 64/64 passing (8 test files)
- `pnpm typecheck`: clean (exit 0)
- `pnpm build`: success — static `/`, dynamic `/api/extract`

## Self-Check: PASSED
