---
phase: 02-real-captions-pipeline-cost-protections
plan: 01
subsystem: schema
tags: [schema, fixtures, video_url, structured-outputs, tdd]
dependency_graph:
  requires: [01-05-SUMMARY.md]
  provides: [updated WorkoutSchema with video_url, backfilled fixtures, ActionBar video_url link]
  affects: [lib/extraction/mock.ts, components/workout/ActionBar.tsx, all test files]
tech_stack:
  added: []
  patterns:
    - required-nullable (z.string().url().nullable()) instead of .optional() — Pitfall 2 guard
    - video_url ?? fallback pattern in ActionBar
key_files:
  created: []
  modified:
    - lib/schema/workout.ts
    - tests/schema.test.ts
    - tests/fixtures/dumbbell-leg-day.json
    - tests/fixtures/bodyweight-push.json
    - tests/fixtures/full-body-2-supersets.json
    - tests/fixtures/warmup-3-exercises.json
    - tests/fixtures/hypertrophy-12-exercises.json
    - components/workout/ActionBar.tsx
    - tests/share-url-roundtrip.test.ts
    - tests/reducer.test.ts
decisions:
  - video_url is required-nullable (not optional) — prevents .optional() Pitfall 2 from breaking OpenAI Structured Outputs
  - All 5 synthetic fixtures get video_url: null (no real source URL exists for synthetic data)
  - ActionBar uses nullish-coalescing: workout.video_url ?? youtube.com/@creator_username
metrics:
  duration_mins: 4
  completed_date: "2026-05-17"
  tasks_completed: 2
  files_changed: 10
---

# Phase 2 Plan 01: Schema Migration — video_url + .optional() Audit Summary

**One-liner:** Added `video_url: z.string().url().nullable()` to WorkoutSchema and confirmed zero `.optional()` usage, preventing OpenAI Structured Outputs failures before the real pipeline is wired.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for video_url | e77c025 | tests/schema.test.ts |
| 1 (GREEN) | Add video_url to WorkoutSchema | ede431a | lib/schema/workout.ts |
| 2 (RED) | Failing round-trip tests for video_url | 1398e3d | tests/share-url-roundtrip.test.ts |
| 2 (GREEN) | Backfill fixtures + update ActionBar | 1585909 | 5 fixtures, ActionBar.tsx, reducer.test.ts |

## What Was Built

### Schema Migration (D-25a)

`video_url: z.string().url().nullable()` added to `WorkoutSchema` after `extraction_confidence`. The field is **required-nullable** (not optional), meaning:
- JSON must include the key (omitting it throws ZodError)
- Value can be `null` or a valid URL string
- Invalid URL strings (e.g. `"not-a-url"`) are rejected by Zod at parse time (T-02-01-01 mitigated)

### .optional() / .nullish() Audit (RESEARCH Pitfall 2)

Audit result: **clean — no changes needed.** The existing Phase 1 schema tree had zero `.optional()` or `.nullish()` usages. All nullable fields were already using `.nullable()`. The `.default([])` pattern on array fields (`form_cues`, `equipment`, `target_muscles`) is preserved and not impacted.

This finding is documented as a deviation (no-op pass, as anticipated in the orchestrator note).

### Fixture Backfill (D-25c)

All 5 synthetic Phase 1 fixtures updated with `"video_url": null` positioned after `extraction_confidence`:
- `tests/fixtures/dumbbell-leg-day.json`
- `tests/fixtures/bodyweight-push.json`
- `tests/fixtures/full-body-2-supersets.json`
- `tests/fixtures/warmup-3-exercises.json`
- `tests/fixtures/hypertrophy-12-exercises.json`

### ActionBar Watch Link (D-25d)

`components/workout/ActionBar.tsx` updated: href now uses `workout.video_url ?? \`https://youtube.com/@${workout.creator_username}\`` — prefers the direct video URL when non-null, falls back to creator channel link.

### Test Coverage

- 4 new schema tests: `video_url: null` accepted, valid URL accepted, invalid URL rejected, omitting field throws
- 2 new share round-trip tests: `video_url: null` round-trips correctly, valid URL round-trips correctly
- Total tests: 98 (up from 92)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] VALID_WORKOUT in tests/reducer.test.ts missing video_url**
- **Found during:** Task 2 GREEN (pnpm typecheck)
- **Issue:** `tests/reducer.test.ts` defines an inline `VALID_WORKOUT` object without `video_url`. After schema change, TypeScript raised `error TS2741: Property 'video_url' is missing`.
- **Fix:** Added `video_url: null as string | null` to the inline `VALID_WORKOUT` constant.
- **Files modified:** `tests/reducer.test.ts`
- **Commit:** 1585909

### No-op Audit Finding

**Orchestrator anticipated this:** The `.optional()` audit in Task 1 was a no-op — the Phase 1 schema was already clean. No `.optional()` or `.nullish()` fields existed anywhere in the schema tree. Documented per orchestrator note.

## Verification Results

```
pnpm test --run: 11 test files, 98 tests — ALL PASSED
pnpm typecheck: exits 0 (no errors)
grep -E "\.optional\(\)|\.nullish\(\)" lib/schema/workout.ts | grep -v "//": 0 matches
All 5 fixtures contain "video_url": null key
ActionBar href uses video_url ?? channel fallback
```

## Known Stubs

None — all fields wired. `video_url: null` in fixtures is intentional (synthetic data has no real source URL). The real pipeline (Phase 2 Plan 06+) will populate `video_url` from the actual YouTube URL passed to `/api/extract`.

## Threat Flags

No new security surface introduced. `video_url` validation (T-02-01-01) is mitigated by `z.string().url()` — invalid URLs rejected at parse time.

## Self-Check: PASSED

- lib/schema/workout.ts: FOUND
- tests/schema.test.ts: FOUND
- tests/fixtures/dumbbell-leg-day.json: FOUND (contains "video_url")
- tests/fixtures/bodyweight-push.json: FOUND (contains "video_url")
- tests/fixtures/full-body-2-supersets.json: FOUND (contains "video_url")
- tests/fixtures/warmup-3-exercises.json: FOUND (contains "video_url")
- tests/fixtures/hypertrophy-12-exercises.json: FOUND (contains "video_url")
- components/workout/ActionBar.tsx: FOUND (contains video_url)
- Commits e77c025, ede431a, 1398e3d, 1585909: FOUND in git log
