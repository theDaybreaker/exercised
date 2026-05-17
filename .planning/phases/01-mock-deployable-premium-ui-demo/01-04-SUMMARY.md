---
phase: 01-mock-deployable-premium-ui-demo
plan: 04
subsystem: ui
tags: [share, lz-string, strip-chain, D-17, D-18, toast, notice, error-handling]

requires:
  - phase: 01-03
    provides: "5 fixtures including hypertrophy-12-exercises.json, ErrorState component, URL-keyword routing"
  - phase: 01-02
    provides: "SharePayloadSchema wrapper (W6 wire format), encodeShareUrl/decodeShareUrl stubs, ExtractFlow hydration, reducer hydrate action"

provides:
  - "Full D-17 strip chain: sourceQuote → form_cues → equipment, stops when encoded ≤ 2048 chars, best-effort (no throw)"
  - "lib/share/notice.ts: unified noticeText() formatter for both sender (toast) and recipient (inline notice)"
  - "ShareStripNotice component: inline notice above WorkoutHeader on stripped share links (role=status + Info icon)"
  - "ActionBar: strips fields from share URL and surfaces notice in sonner toast description"
  - "ErrorState: D-18 heading override for schema_version mismatch — friendly 'This share link uses a newer version.'"
  - "CI fixture-share-sizes test: logs compressed payload size for all 5 fixtures on every CI run"
  - "SHRE-03 fully covered: URL-encoded share link recreates workout view, schema-version-aware"

affects: [01-05, phase-2-ai-integration]

tech-stack:
  added: []
  patterns:
    - "D-17 strip chain: best-effort compression reducer — strip in STRIP_ORDER until ≤ 2048 or exhausted"
    - "Unified notice formatter: single noticeText() function shared between sender toast and recipient notice"
    - "Structural content-based testing: readFileSync assertions for UI components (no jsdom needed)"
    - "D-18 substring-keyed override: ErrorState checks message.includes() to override heading/body for schema-version errors"

key-files:
  created:
    - lib/share/notice.ts
    - lib/share/encode.ts (strip chain implementation)
    - components/workout/ShareStripNotice.tsx
    - tests/share-strip-chain.test.ts
    - tests/fixture-share-sizes.test.ts
    - tests/share-strip-notice.test.ts
  modified:
    - lib/share/encode.ts
    - components/workout/WorkoutView.tsx
    - components/workout/ActionBar.tsx
    - components/extract/ErrorState.tsx
    - components/extract/ExtractFlow.tsx
    - tests/share-url-roundtrip.test.ts

key-decisions:
  - "D-17 strip chain is best-effort: if all 3 fields stripped and payload still > 2KB, function returns anyway (no hard gate per D-17 spec)"
  - "noticeText() prefers D-17 verbatim form_cues copy when form_cues included (regardless of sourceQuote); all-3 case uses Oxford-comma list"
  - "D-18 heading override keyed by message.includes('newer version of Exercised') substring — simple, no new ErrorCode enum value needed; Future Plan 01-05+ may introduce dispatch({type:'error', code:'SCHEMA_VERSION'}) for cleaner dispatch shape"
  - "WorkoutView passes shareLinkOmittedFields only when fromShareLink=true — no notice shown on freshly-extracted workouts even if they would trigger strip"
  - "dumbbell-leg-day fixture compresses to 2089 chars (> 2048 threshold) and DOES trigger strip; plan must_have claim was incorrect — real behavior confirmed by STATE.md note"

patterns-established:
  - "Strip-chain pattern: attempt(0)=full, attempt(1-3)=strip next field, return immediately when ≤ threshold"
  - "Shared notice formatter: lib/share/notice.ts is imported by both ActionBar (sender) and ShareStripNotice (recipient) — single source of truth for copy variants"

requirements-completed: [SHRE-03]

duration: 7min
completed: 2026-05-17
---

# Phase 1, Plan 04: Share URL Strip Chain + Strip Notice UI Summary

**D-17 full strip chain live: sharing any workout produces a ≤2KB URL by stripping optional fields in order, with honest 'Share link omits X for length' notice to both sender (toast) and recipient (inline above header); D-18 schema-version URLs surface friendly ErrorState instead of crashes.**

## Performance

- **Duration:** 7 minutes
- **Started:** 2026-05-17T18:24:02Z
- **Completed:** 2026-05-17T18:31:30Z
- **Tasks:** 2 of 2
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments

### Task 1: D-17 Strip Chain Implementation

Replaced the Plan 01-02 no-op placeholder in `lib/share/encode.ts` with the full D-17 strip loop:

```ts
const STRIP_ORDER: StripField[] = ["sourceQuote", "form_cues", "equipment"];
```

The chain runs at most 3 iterations — on each iteration it attempts encoding with the current candidate workout; if the compressed result fits under 2048 chars, it returns immediately. The chain never throws — if all 3 fields are stripped and the payload is still over 2KB, the fully-stripped result is returned (best-effort, per D-17 spec).

**Actual compressed sizes measured in CI (from `fixture-share-sizes.test.ts` verbose output):**

| Fixture | Encoded size | Stripped fields |
|---------|-------------|-----------------|
| dumbbell-leg-day | 1813 bytes | [sourceQuote] |
| bodyweight-push | 1917 bytes | [] |
| full-body-2-supersets | 1946 bytes | [sourceQuote] |
| warmup-3-exercises | 1185 bytes | [] |
| hypertrophy-12-exercises | 1773 bytes | [sourceQuote, form_cues] |

The hypertrophy fixture (12 exercises) required stripping both `sourceQuote` and `form_cues` to fit under 2KB — resulting in a 1773-char URL, well within Slack/Discord/Twitter limits.

### Task 2: Strip Notice UI + D-18 Error Path

- **`lib/share/notice.ts`**: `noticeText(stripped: StripField[]): string` — canonical copy variants per D-17. Imports both by ActionBar (sender toast) and ShareStripNotice (recipient inline notice).
- **`components/workout/ShareStripNotice.tsx`**: `role="status"` div with lucide `Info` icon (14px, aria-hidden) + notice text above WorkoutHeader. Returns null when stripped is empty.
- **`components/workout/WorkoutView.tsx`**: New `shareLinkOmittedFields?: StripField[]` prop. Renders `<ShareStripNotice>` above the motion-animated header when non-empty (only when `fromShareLink=true` in ExtractFlow).
- **`components/workout/ActionBar.tsx`**: Share handler now destructures `{ encoded, stripped }` from `encodeShareUrl`. When `stripped.length > 0`, `toast.success("Share link copied", { description: noticeText(stripped) })`.
- **`components/extract/ErrorState.tsx`**: D-18 heading override — when `code === "UNKNOWN"` and `message.includes("newer version of Exercised")`, surfaces `heading: "This share link uses a newer version."` and `body: "Try pasting the original YouTube URL instead."` instead of the generic UNKNOWN copy.

## noticeText() Copy Decision

The formatter uses a priority-based approach matching D-17 verbatim:

| Stripped fields | Copy |
|----------------|------|
| [] | "" (empty — no notice) |
| ["sourceQuote"] | "Share link omits source quotes for length." |
| ["form_cues"] or ["sourceQuote", "form_cues"] | "Share link omits form cues for length." (D-17 verbatim main case) |
| ["sourceQuote", "form_cues", "equipment"] | "Share link omits source quotes, form cues, and equipment for length." |

The `form_cues` case (with or without `sourceQuote`) uses the D-17 verbatim line — this covers the most common case (hypertrophy fixture). The all-3 case uses an Oxford-comma list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan must_have claimed dumbbell-leg-day fits under 2KB without stripping**
- **Found during:** Task 1 GREEN phase (first test run)
- **Issue:** The plan's `must_haves.truths` stated dumbbell-leg-day "fits under 2KB without stripping." The actual compressed size is 2089 chars (over 2048). This was already documented in STATE.md ("lz-string encoded 2089 chars").
- **Fix:** Updated test expectations in `tests/share-strip-chain.test.ts` and `tests/share-url-roundtrip.test.ts` to use bodyweight-push (1917 chars) and warmup-3 (1185 chars) as the "no-strip" example fixtures. dumbbell-leg-day correctly triggers strip → sourceQuote removed → 1813 chars.
- **Files modified:** tests/share-strip-chain.test.ts, tests/share-url-roundtrip.test.ts
- **No impact on encoder behavior** — the encoder's logic was always correct; only test expectations were wrong.

## D-18 Schema-Version Error: Design Decision for Future Plans

The current implementation uses `message.includes("newer version of Exercised")` substring matching to override the ErrorState heading. This is simple and avoids adding a new ErrorCode enum value.

**Future improvement:** Plans 01-05+ may introduce `dispatch({ type: "error", code: "SCHEMA_VERSION", message: "..." })` as a dedicated action. This would allow ErrorState to use `code === "SCHEMA_VERSION"` directly (cleaner, no substring matching). The reducer already supports arbitrary ErrorCode extensions — it's a one-line enum addition.

## Plan 01-05 Hand-off

Remaining Phase 1 gaps (not in scope for 01-04):
- **(a) Mobile glass perf fallback validation** — backdrop-filter cost on mid-range Android
- **(b) Per-moment reduced-motion compliance** — audit all 7 Motion moments against `prefers-reduced-motion`
- **(c) Sticky-bottom mobile ActionBar** — currently inline on all viewports
- **(d) axe-core DSGN-06 audit** — gradient accessibility check on deployed URL
- **(e) Tooltip disambiguation** on Copy as Markdown vs Copy as Plain Text buttons
- **(f) Cross-browser/cross-device share-link smoke test** — OPS-02 gate (requires GitHub remote + Vercel deploy)

## Self-Check: PASSED

- [x] `lib/share/encode.ts` contains STRIP_ORDER with `sourceQuote` first
- [x] `lib/share/notice.ts` exists and exports `noticeText`
- [x] `components/workout/ShareStripNotice.tsx` exists with `role="status"` and Info import
- [x] `components/workout/WorkoutView.tsx` renders `<ShareStripNotice>` (2 occurrences)
- [x] `components/workout/ActionBar.tsx` destructures `{ encoded, stripped }` and passes `description`
- [x] `components/extract/ErrorState.tsx` contains D-18 heading override
- [x] `tests/share-strip-chain.test.ts` exists and passes (7 test cases)
- [x] `tests/fixture-share-sizes.test.ts` exists and passes (logs visible in verbose CI)
- [x] `tests/share-strip-notice.test.ts` exists and passes (19 test cases)
- [x] All 92 tests pass
- [x] TypeScript typecheck clean
- [x] Next.js build succeeds
