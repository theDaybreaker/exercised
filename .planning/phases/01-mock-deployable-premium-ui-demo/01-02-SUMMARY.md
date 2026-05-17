---
phase: 01-mock-deployable-premium-ui-demo
plan: "02"
subsystem: ui
tags: [sse, useReducer, fsm, share-url, lz-string, clipboard, motion, glassmorphism, workout-render, shadcn, vercel]

dependency_graph:
  requires:
    - phase: 01-mock-deployable-premium-ui-demo
      plan: "01"
      provides: [WorkoutSchema, ExtractEventSchema, ExtractionService, MockExtractionService, POST /api/extract, app/globals.css, AmbientBackground, Footer]
  provides:
    - ExtractFlow Client island (useReducer FSM + SSE consumer + share-link hydration on mount)
    - reducer FSM (5 states: idle|submitting|streaming|success|error; 6 actions: submit|stage|success|error|hydrate|reset)
    - LoadingStages (4-stage cascade with pulse-dot/checkmark indicators + 4 skeleton cards; aria-live)
    - UrlInput (glass-styled input + CTA with YouTube URL validation)
    - SkeletonCard (shimmer animation glass card for loading state)
    - WorkoutView (Motion stagger cascade; spring damping 22 stiffness 240; 65ms stagger; useReducedMotion compliance)
    - WorkoutHeader (title + creator + DurationChip + DifficultyChip + MusclePills)
    - ExerciseCard (sets/reps in Geist Mono; form-cue expand toggle with chevron animation)
    - SupersetCard (bracketed grouping with --color-accent left border; shared rest indicator)
    - ActionBar (Watch on YouTube + Copy MD + Copy Plain + Share Workout with sonner toasts)
    - SharePayloadSchema wrapper (W6 — stable wire format from first deploy: { workout, stripped: [] })
    - encodeShareUrl (lz-string compressToEncodedURIComponent against SharePayload wrapper)
    - decodeShareUrl (50KB DoS cap + SharePayloadSchema.safeParse + D-18 schema_version mismatch error)
    - workoutToMarkdown (SHRE-01 clipboard export)
    - workoutToPlainText (SHRE-02 clipboard export)
    - README.md at repo root
  affects:
    - 01-03 (ErrorState component, additional fixtures, URL-keyword error branches)
    - 01-04 (strip-chain loop in encodeShareUrl — TODO(Plan 01-04) comment marks the spot)
    - 01-05 (sticky-bottom ActionBar mobile variant, reduced-motion per-moment refinement)

tech-stack:
  added: []
  patterns:
    - useReducer FSM with pure reducer — all UI state in one place (idle|submitting|streaming|success|error)
    - SSE consumer via fetch().body.pipeThrough(new TextDecoderStream()).getReader() loop
    - Share URL encode/decode: lz-string against SharePayloadSchema wrapper (W6 stable from first deploy)
    - Motion stagger cascade with spring {damping:22, stiffness:240}, 65ms staggerChildren, useReducedMotion compliance
    - Form-cue expand toggle via Motion <motion.div animate={height}> with cubic-bezier(0.22, 1, 0.36, 1)

key-files:
  created:
    - components/extract/reducer.ts
    - components/extract/ExtractFlow.tsx
    - components/extract/UrlInput.tsx
    - components/extract/LoadingStages.tsx
    - components/workout/SkeletonCard.tsx
    - components/workout/WorkoutView.tsx
    - components/workout/WorkoutHeader.tsx
    - components/workout/ExerciseCard.tsx
    - components/workout/SupersetCard.tsx
    - components/workout/MusclePill.tsx
    - components/workout/DifficultyChip.tsx
    - components/workout/DurationChip.tsx
    - components/workout/ActionBar.tsx
    - lib/share/encode.ts
    - lib/share/decode.ts
    - lib/clipboard/markdown.ts
    - lib/clipboard/plaintext.ts
    - tests/reducer.test.ts
    - tests/share-url-roundtrip.test.ts
    - tests/clipboard.test.ts
    - README.md
  modified:
    - app/page.tsx (replaced placeholder hero with <ExtractFlow />)
    - lib/schema/workout.ts (added SharePayloadSchema + StripFieldSchema + types)
    - app/globals.css (added skeleton-shimmer + pulse-dot keyframes)

key-decisions:
  - "W6: SharePayloadSchema wrapper defined in Plan 01-02 so wire format is stable from first deploy — Plan 01-04 only adds strip-chain logic internally, never changes the { workout, stripped } wire shape"
  - "Share-link hydration (D-16): ExtractFlow mount-effect dispatches 'hydrate' action (fromShareLink: true) → WorkoutView gets shouldAnimateIn=false → instant render, no cascade animation"
  - "Fixture compressed size: dumbbell-leg-day raw JSON is 2706 bytes (over 2KB threshold) — Plan 01-04 strip-chain will address; Plan 01-02 lz-string-encoded form is 2089 URL-safe chars, well under browser URL limits"
  - "D-18 schema_version mismatch: decodeShareUrl inspects safeParse error paths for schema_version → friendly 'newer version of Exercised' message instead of generic parse error"
  - "T-02-01 DoS mitigation: 50,000-char sanity cap BEFORE JSON.parse in decodeShareUrl — lz-string bomb cannot reach the parser"

requirements-completed:
  - INPT-01
  - INPT-02
  - PIPE-05
  - OUTV-01
  - OUTV-03
  - OUTV-04
  - OUTV-05
  - OUTV-06
  - SHRE-01
  - SHRE-02
  - SHRE-03

duration: "~90min (Tasks 1-5)"
completed: "2026-05-17"
---

# Phase 01 Plan 02: Interactive UI + Share Encode/Decode + Vercel Deploy Summary

**SSE-driven 4-stage loading cascade + WorkoutView glass cards with Motion stagger + SharePayloadSchema wire-stable share URLs + clipboard exporters — all verified locally; Vercel deploy pending GitHub remote push by user for OPS-02 acceptance.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-05-17
- **Completed:** 2026-05-17
- **Tasks:** 5 (Tasks 1–3 + 4 human-approved + 5 README committed; Vercel push blocked on GitHub remote auth gate)
- **Files created:** 21
- **Files modified:** 3

## Accomplishments

- ExtractFlow Client island with pure useReducer FSM (5 states, 6 actions), SSE consumer via ReadableStream + TextDecoderStream, share-link hydration on mount (D-16), and the complete render-state tree (idle → UrlInput, submitting/streaming → LoadingStages, success → WorkoutView, error → inline fallback)
- Full workout render tree: WorkoutHeader + ExerciseCard + SupersetCard (bracketed superset with --color-accent left border) + MusclePill + DifficultyChip + DurationChip + ActionBar — all glass-card styled, sets/reps in Geist Mono, form-cue expand toggle with Motion height animation
- SharePayloadSchema W6 wire format (stable from first deploy): encodeShareUrl wraps { workout, stripped:[] } in lz-string; decodeShareUrl validates against SharePayloadSchema.safeParse with 50KB DoS cap + D-18 schema_version mismatch detection; round-trip test suite (7 Vitest cases) all pass
- workoutToMarkdown + workoutToPlainText clipboard exporters (SHRE-01/02); sonner toasts on all 3 ActionBar actions (Copy MD, Copy Plain, Share Workout)
- 30 Vitest tests passing (5 test files: schema, youtube-url, reducer, share-url-roundtrip, clipboard); typecheck clean; production build succeeds
- Human-verified (Task 4): all 15 local verification steps passed — SSE cascade, Motion stagger, form-cue expand, clipboard copy, share-link cross-tab round-trip, reduced-motion compliance

## Task Commits

TDD RED/GREEN pattern for Tasks 1 and 2:

1. **TDD RED — reducer FSM tests** - `553fc52` (test)
2. **Task 1: ExtractFlow + reducer + SSE + LoadingStages + UrlInput + SkeletonCard** - `3b26093` (feat)
3. **TDD RED — share round-trip + clipboard tests** - `bf63d97` (test)
4. **Task 2: SharePayloadSchema + encode/decode + clipboard exporters** - `aef88f0` (feat)
5. **Task 3: WorkoutView + header + cards + ActionBar** - `9db7617` (feat)
6. **Task 4: Human verify (approved)** — no code commit (verification-only gate)
7. **Task 5: README.md** - `6e3f9dc` (feat)

**Vercel deploy commit:** Pending — blocked on GitHub remote configuration (see User Setup Required below).

## Files Created/Modified

### Created
- `components/extract/reducer.ts` — Pure FSM reducer: 5 states (idle|submitting|streaming|success|error), 6 actions (submit|stage|success|error|hydrate|reset); `completedStages` computed from `STAGE_ORDER.slice(0, indexOf(action.stage))`
- `components/extract/ExtractFlow.tsx` — Client island: useReducer + SSE consumer loop + share-link hydration mount-effect + 4 render-state branches
- `components/extract/UrlInput.tsx` — Glass input with YouTube URL validation; minimal error on invalid (full inline error in Plan 01-03)
- `components/extract/LoadingStages.tsx` — 4-stage labels with pulse-dot/checkmark + 4 SkeletonCard; aria-live="polite" SR announcements
- `components/workout/SkeletonCard.tsx` — Shimmer glass card for loading state
- `components/workout/WorkoutView.tsx` — Motion stagger cascade (spring damping:22 stiffness:240, 65ms staggerChildren, useReducedMotion compliance)
- `components/workout/WorkoutHeader.tsx` — Title + creator handle + DurationChip + DifficultyChip + MusclePills in glass card
- `components/workout/ExerciseCard.tsx` — Sets/reps in Geist Mono tabular-nums; form-cue expand toggle with Motion height animation + ChevronDown rotation
- `components/workout/SupersetCard.tsx` — Bracketed grouping with --color-accent left border; "Superset · rest Ns" header; shared rest indicator
- `components/workout/MusclePill.tsx` — Small glass chip with padding px-3 py-1
- `components/workout/DifficultyChip.tsx` — beginner → muted; intermediate/advanced → --color-accent border + label
- `components/workout/DurationChip.tsx` — Clock icon + "~N min" label
- `components/workout/ActionBar.tsx` — 4 buttons: Watch on YouTube (asChild a tag + ExternalLink icon), Copy MD, Copy Plain, Share Workout
- `lib/share/encode.ts` — encodeShareUrl: wraps in { workout, stripped:[] }; TODO(Plan 01-04) marks strip-chain insertion point
- `lib/share/decode.ts` — decodeShareUrl: lz-decompress + 50KB cap + JSON.parse + SharePayloadSchema.safeParse + D-18 version mismatch error
- `lib/clipboard/markdown.ts` — workoutToMarkdown: # title + by @handle + difficulty/duration + target muscles + ## exercise sections + superset grouping
- `lib/clipboard/plaintext.ts` — workoutToPlainText: numbered exercise list; superset as a)/b) sub-items; no markdown chars
- `tests/reducer.test.ts` — 5 named Vitest cases covering all 5 FSM actions
- `tests/share-url-roundtrip.test.ts` — 7 named Vitest cases: round-trip equality, tampered input, schema_version mismatch, DoS cap, schema variants, Plan 01-04 forward compatibility
- `tests/clipboard.test.ts` — 4 named Vitest cases: markdown structure, plaintext structure, empty form-cues, purity
- `README.md` — Project description + Local development + Deployment + Architecture sections

### Modified
- `app/page.tsx` — Replaced placeholder hero with `<ExtractFlow />` + `<Footer />`
- `lib/schema/workout.ts` — Added `StripFieldSchema`, `SharePayloadSchema`, `StripField`, `SharePayload` exports (W6)
- `app/globals.css` — Added `skeleton-shimmer` keyframes + `.skeleton-shimmer` class + `.pulse-dot` keyframes

## Decisions Made

- **W6 wire format stability:** SharePayloadSchema wrapper defined in Plan 01-02 (not Plan 01-04) so all share URLs minted after first deploy decode under the same schema. Plan 01-04 only populates the strip-chain loop body, never changes the `{ workout, stripped }` wire shape.
- **Task ordering:** Task 2 (share modules) executed before Task 1 (ExtractFlow) to avoid a temporary mock import. The plan notes this as an option: "Easiest: do Task 2 first inside this plan."
- **decodeShareUrl D-18 path:** `i.path.join(".")` check for `"workout.schema_version"` covers nested path; `i.path[0] === "schema_version"` covers legacy bare-workout payloads.
- **dumbbell-leg-day compressed size:** Raw JSON is 2706 bytes (over 2KB threshold). Plan 01-04 strip-chain will handle this. For Plan 01-02, the lz-string encoded form is 2089 URL-safe chars — well within URL limits and functional.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1–5.

## Known Stubs

| Stub | File | Reason | Resolving Plan |
|------|------|--------|----------------|
| `encodeShareUrl` strip-chain is a no-op (TODO) | `lib/share/encode.ts` | Intentional W6 placeholder — Plan 01-04 fills the loop body | Plan 01-04 |
| Error state renders bare `<div role="alert">` | `components/extract/ExtractFlow.tsx` | Plan 01-03 ships full ErrorState component | Plan 01-03 |
| UrlInput inline error is minimal (no aria-invalid) | `components/extract/UrlInput.tsx` | Plan 01-03 adds aria-invalid + aria-describedby polish | Plan 01-03 |
| ActionBar "Watch on YouTube" links to `@handle` not `startTimestamp` | `components/workout/ActionBar.tsx` | Phase 4 polish per CONTEXT.md `<deferred>` | Phase 4 |
| ActionBar mobile sticky-bottom variant not shipped | `components/workout/ActionBar.tsx` | Plan 01-05 | Plan 01-05 |

## Wire Format Confirmation (W6)

The `SharePayloadSchema`-wrapped payload (`{ workout, stripped: [] }`) encodes and decodes correctly in Plan 01-02. The `stripped: []` no-op is shipped. Plan 01-04 will only change encode.ts internals (the TODO loop body) — the `stripped` field exists in the wire format from day one, so no in-flight share URLs will break when Plan 01-04 deploys.

**Fixture compressed payload sizes (Plan 01-02 baseline):**

| Fixture | Raw JSON (bytes) | lz-string encoded (chars) | Over 2KB threshold? |
|---------|-------------------|--------------------------|---------------------|
| dumbbell-leg-day | 2706 | 2089 | Yes — Plan 01-04 strip-chain |

## Production Verification (Task 5 — OPS-02 gate)

**Status: Pending — GitHub remote not configured locally.**

README.md has been authored and committed (`6e3f9dc`). All code for Plans 01-01 and 01-02 is committed to `main`.

**Required human action to complete Task 5:**

1. Add GitHub remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/exercised.git
   git push -u origin main
   ```
2. Vercel will auto-deploy from `main` via GitHub integration. Monitor in Vercel dashboard.
3. Once deployed, run the production verification:
   ```bash
   PROD_URL=https://your-deploy.vercel.app
   curl -sI "$PROD_URL" | head -5
   curl -sN -X POST "$PROD_URL/api/extract" -H 'Content-Type: application/json' \
     -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' --max-time 8 | tee /tmp/prod-sse.log
   grep -c '"type":"stage"' /tmp/prod-sse.log
   grep -c '"type":"result"' /tmp/prod-sse.log
   curl -sI -X POST "$PROD_URL/api/extract" -H 'Content-Type: application/json' \
     -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | grep -i "x-accel-buffering"
   ```
4. OPS-02 human gate: open `$PROD_URL` in browser, paste YouTube URL, confirm SSE cascade + workout render, click Share Workout, open share link in a second browser/device and confirm instant render.

**Expected results once deployed:**
- HTTP 200 on `GET /`
- `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` headers on POST /api/extract
- 4 stage events + 1 result event in ~4–5s
- HTTP 400 for empty body
- Share link round-trip works cross-browser/cross-device (OPS-02)

## Plan 01-03 Hand-off

**Four additional fixtures to add (MockExtractionService D-12 hash selector will use them):**
1. `bodyweight-push` — push-day bodyweight routine
2. `full-body-2-supersets` — two supersets in one routine
3. `warmup-3-exercises` — simple 3-exercise warmup
4. `hypertrophy-12-exercises` — full 12-exercise hypertrophy block

**URL-keyword error branches** (CONTEXT.md D-13): Mock service recognizes specific URL keywords and returns structured error events:
- `?keyword=no_workout` → `ErrorCode.NO_WORKOUT`
- `?keyword=network` → `ErrorCode.NETWORK_ERROR`
- `?keyword=rate_limit` → `ErrorCode.RATE_LIMITED`

**ErrorState component (Plan 01-03):** Full error UI for NETWORK/NO_WORKOUT/RATE_LIMITED variants replacing the bare `<div role="alert">` in ExtractFlow.tsx.

**URL-validation inline error (Plan 01-03):** Full `aria-invalid` + `aria-describedby` polish + tracking-param paste handler.

## Issues Encountered

**GitHub remote not configured:** The local git repo has no GitHub remote. The GSD executor cannot push to GitHub via SSH (no SSH keys configured: `git@github.com: Permission denied (publickey)`). The user needs to add the remote and push manually to trigger the Vercel auto-deploy.

This is an authentication gate, not a code defect. All Plan 01-02 code is committed and verified locally.

## User Setup Required

**To complete Task 5 (OPS-02 acceptance gate):**

1. Add GitHub remote:
   ```bash
   git remote add origin https://github.com/<your-username>/exercised.git
   git push -u origin main
   ```
   Or via SSH if you have keys configured:
   ```bash
   git remote add origin git@github.com:<your-username>/exercised.git
   git push -u origin main
   ```

2. Monitor Vercel deploy: https://vercel.com/dashboard

3. Once deployed, paste the production URL (`PROD_URL`) into `.planning/STATE.md` `stopped_at` field and run the production verification commands above.

4. OPS-02 human gate: confirm share-link works cross-browser/cross-device on the live URL.

## Threat Flags

No new security-relevant surface introduced beyond what was designed in the plan's `<threat_model>`:
- T-02-01 (share-link DoS) — mitigated in decodeShareUrl (50KB cap + SharePayloadSchema.safeParse)
- T-02-02 (schema_version leak) — mitigated (D-18 friendly message)
- T-02-08 (clickjacking) — accepted (Vercel default SAMEORIGIN headers; verify via curl -I on first deploy)

## Self-Check

### Files Exist
- `components/extract/reducer.ts` — FOUND
- `components/extract/ExtractFlow.tsx` — FOUND
- `components/workout/WorkoutView.tsx` — FOUND
- `lib/share/encode.ts` — FOUND
- `lib/share/decode.ts` — FOUND
- `lib/clipboard/markdown.ts` — FOUND
- `lib/clipboard/plaintext.ts` — FOUND
- `README.md` — FOUND

### Commits Exist
- `553fc52` — test(01-02): add failing reducer FSM tests (TDD RED)
- `3b26093` — feat(01-02): Task 1 — reducer FSM + SSE consumer + ExtractFlow + LoadingStages + UrlInput + SkeletonCard
- `bf63d97` — test(01-02): add failing share round-trip + clipboard tests (TDD RED)
- `aef88f0` — feat(01-02): Task 2 — SharePayloadSchema wrapper + encode/decode + clipboard exporters
- `9db7617` — feat(01-02): Task 3 — WorkoutView + header + exercise/superset cards + chips/pills + ActionBar
- `6e3f9dc` — feat(01-02): Task 5 — README.md with local dev + deployment + architecture sections

### Verification Results
- `pnpm test`: 30/30 tests passing (5 test files)
- `pnpm typecheck`: clean (exit 0)
- `pnpm build`: success — `/` static, `/api/extract` dynamic

## Self-Check: PASSED (local verification)

All files exist. All commits verified. Tests, typecheck, and build all pass. OPS-02 production verification pending GitHub remote setup by user.

---
*Phase: 01-mock-deployable-premium-ui-demo*
*Completed: 2026-05-17*
