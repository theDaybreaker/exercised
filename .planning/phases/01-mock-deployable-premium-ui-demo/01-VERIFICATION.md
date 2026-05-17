---
phase: 01-mock-deployable-premium-ui-demo
verified: 2026-05-17T21:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm Watch on YouTube link is acceptable as @creator channel link (not source video URL)"
    expected: "OUTV-05 requires 'linking to the source video' — current implementation links to creator channel. Verify whether this partial implementation is acceptable for Phase 1 or should be flagged for Phase 2."
    why_human: "The Watch button links to https://youtube.com/@creator_username, not the original submitted YouTube URL. The schema has no video_url field. OUTV-05 says 'linking to the source video and crediting the creator' — this is architecturally impossible in the current mock design since the source URL is not stored in WorkoutSchema. SC-1 only says 'Watch on YouTube link' (link presence, not destination). A human must decide if this is acceptable."
  - test: "Confirm REQUIREMENTS.md DSGN-05 and DSGN-06 checkboxes should be marked complete"
    expected: "Both checkboxes appear as [ ] (unchecked) in .planning/REQUIREMENTS.md despite Plan 01-05 implementing and verifying both in production."
    why_human: "The code fully implements both: DSGN-05 (hover lift on .glass-card with prefers-reduced-motion gate across all 7 moments) and DSGN-06 (axe-core 0 violations confirmed at HEAD=25cdbe3). The REQUIREMENTS.md traceability table was not updated when Plan 01-05 closed them. A human should decide whether to update the file or accept the tracking discrepancy."
  - test: "Confirm timing deviation (SC-1 says ~3 seconds, production delivers ~4.5 seconds)"
    expected: "SC-1 states 'within ~3 seconds'. Production SSE stream completes in ~4.5s. D-07 deliberately set this slower for readability. The Discussion Log shows this was a conscious design choice. A human should confirm this deviation is accepted."
    why_human: "The ~3s vs ~4.5s gap is deliberate (D-07, CONTEXT.md). The discussion log explicitly records the user selecting the 4-5s option. PIPE-03 says '~3 seconds' but D-07 overrides it to 4-5s. Whether this constitutes a failed SC-1 or an accepted deviation requires human judgment."
---

# Phase 1: Mock-Deployable Premium UI Demo Verification Report

**Phase Goal:** Ship a deployed-to-Vercel demo URL where users can paste a YouTube URL, watch a real SSE-driven pipeline animation, and see a fully-rendered fixture workout in premium dark glassmorphism — every visible product behavior works end-to-end against fixtures

**Verified:** 2026-05-17T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Production URL Spot-Check

| Check | Result | Status |
|-------|--------|--------|
| `GET https://exercised-ten.vercel.app` | HTTP 200 | PASS |
| POST `/api/extract` emits SSE | 4 stage events + 1 result | PASS |
| SSE header `Content-Type` | `text/event-stream; charset=utf-8` | PASS |
| SSE header `Cache-Control` | `no-cache, no-transform` | PASS |
| SSE header `X-Accel-Buffering` | `no` | PASS |
| Invalid request returns 400 | HTTP 400 with `issues` array | PASS |
| SSE stream duration (wall clock) | ~4.5s (curl timed at 4.592s) | NOTED — see SC-1 |

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Live Vercel URL: paste YouTube URL → fixture workout in premium dark glassmorphism with all required UI elements | VERIFIED (with timing caveat) | `https://exercised-ten.vercel.app` returns HTTP 200; production SSE stream produces all 4 stages + result; WorkoutHeader at `components/workout/WorkoutHeader.tsx:33-51` renders title/creator/duration/difficulty/muscle pills; glass-card CSS at `app/globals.css:104-115` implements backdrop-blur(16px); Watch on YouTube button exists at `components/workout/ActionBar.tsx:85-100` (links to @channel, not video — see human check); AI disclaimer at `components/layout/Footer.tsx:9-14` |
| 2 | SSE streams real stage events (fetching → transcribing → analyzing → generating); EXTRACT_MODE env var swaps mock→real without frontend change | VERIFIED | Production curl confirms 4 stage events in sequence; `lib/extraction/service.ts:16-24` reads `EXTRACT_MODE` env var, routes to `MockExtractionService` or `RealExtractionService`; frontend only touches `ExtractEventSchema` at `components/extract/ExtractFlow.tsx:115`; `lib/extraction/real.ts` stub exists and throws with clear error if activated prematurely |
| 3 | Copy as Markdown, Copy as Plain Text, Share Workout link recreates workout with no backend round-trip | VERIFIED | `lib/share/encode.ts` implements lz-string D-17 strip chain; `lib/share/decode.ts` implements 50KB DoS cap + SharePayloadSchema validation + D-18 schema_version mismatch; `components/extract/ExtractFlow.tsx:43-56` reads `?w=` param on mount and dispatches `hydrate` action; 92/92 Vitest tests pass including 7 share round-trip tests and 19 strip-notice tests |
| 4 | Invalid URLs rejected inline before API call; extraction failures + no-workout → distinct honest error states with retry | VERIFIED | `components/extract/UrlInput.tsx:50-57` validates before calling `onSubmit`; `lib/youtube/url.ts` (parseYouTubeUrl) returns `isValid=false` for non-YouTube URLs; `components/extract/ErrorState.tsx` implements 4 variants (NETWORK/NO_WORKOUT/RATE_LIMITED/UNKNOWN); URL-keyword routing in `lib/extraction/mock.ts:57-89` triggers error states via `/fail/i`, `/empty/i`, `/rate-limit/i` |
| 5 | Zod WorkoutSchema is single source of truth with all forward-looking fields; byte-compatible with brief example JSON | VERIFIED | `lib/schema/workout.ts:3-13` defines `ExerciseCoreSchema` with `startTimestamp`, `sourceQuote`, `equipment[]`; `WorkoutSchema:32-41` includes `extraction_confidence` and `schema_version: z.literal("1")`; `discriminatedUnion("type", [StandardSetSchema, SupersetSchema])` at line 26; all 5 fixtures parse cleanly under `WorkoutSchema.parse()` at module load (D-14); 92/92 tests pass |

**Score:** 5/5 truths VERIFIED (3 human confirmation items for deviations — see Human Verification section)

---

### Detailed SC-by-SC Verdicts

#### SC-1 — Live URL, Fixture Workout, Premium Glassmorphism, ~3 Seconds

**Verdict: PARTIAL** (with accepted deviation)

Evidence in code:
- Production URL live: `https://exercised-ten.vercel.app` → HTTP 200
- `app/page.tsx:15-45` wires `<AmbientBackground />`, `<ExtractFlow />`, `<Footer />`
- WorkoutHeader (`components/workout/WorkoutHeader.tsx`) renders: title (line 33), creator (line 41), DurationChip (line 46), DifficultyChip (line 47), MusclePills (lines 48-50)
- ExerciseCard, SupersetCard, ActionBar all wired in WorkoutView
- AI-disclaimer footer: `components/layout/Footer.tsx:9-14`
- Glass design: `app/globals.css:104-115` (.glass-card, backdrop-blur:16px, saturate:140%, border)
- Ambient gradient: `components/layout/AmbientBackground.tsx` (3 drifting orbs)

**Timing deviation:** SC-1 says "within ~3 seconds". Production SSE stream measured at 4.592 seconds. D-07 (CONTEXT.md line 31) deliberately sets stage dwell to 1100/1100/1100/1000ms (~4.4s total). The DISCUSSION-LOG.md records the user selecting the 4-5s option over the 3s option. PIPE-03 says "~3 seconds" but was overridden by D-07. This is a documented, intentional deviation — the 01-05-SUMMARY.md notes "renders in ~4-5s per D-07 (confirmed correct behavior)".

**Watch on YouTube link:** The link exists (`components/workout/ActionBar.tsx:86-100`) but goes to `https://youtube.com/@creator_username` (the creator's channel), not the original submitted YouTube video URL. The Workout schema (`lib/schema/workout.ts`) has no `video_url` field, making it architecturally impossible to link back to the specific video without schema changes. Plan 01-02 SUMMARY documents this as a known stub deferred to Phase 4. SC-1 says "Watch on YouTube link" — the link is present. OUTV-05 says "linking to the source video" — this is not met. See Human Verification item 1.

#### SC-2 — SSE Stage Events Stream; EXTRACT_MODE Swap

**Verdict: PASS**

- Production confirms 4 SSE stage events and 1 result event via curl
- `app/api/extract/route.ts:10-13` sets `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`
- All 4 required SSE headers confirmed in production response
- `lib/extraction/service.ts:16-24` implements the factory pattern; `EXTRACT_MODE` env var routes to mock vs real
- `lib/extraction/real.ts` throws explicitly with "not implemented" if activated early (T-01-07)
- `ExtractFlow.tsx` is entirely event-driven: receives `ExtractEvent` objects, never timers (D-10)

#### SC-3 — Copy as Markdown, Copy as Plain Text, Share Workout Round-Trip

**Verdict: PASS**

- `lib/clipboard/markdown.ts` and `lib/clipboard/plaintext.ts` exist and are tested (4 Vitest cases each)
- `lib/share/encode.ts:22-48` implements D-17 strip chain: sourceQuote → form_cues → equipment, best-effort under 2048 chars
- `lib/share/decode.ts:19-50` implements 50KB DoS cap, SharePayloadSchema.safeParse, D-18 version mismatch
- `ExtractFlow.tsx:43-56` reads `?w=` on mount, dispatches hydrate action → instant WorkoutView render, no API call
- Strip notice: `components/workout/ShareStripNotice.tsx` shows `role="status"` banner when fields were stripped
- Cross-device smoke test approved by user in Plan 01-05 Task 3b (all 7 steps pass)
- Measured compressed sizes: dumbbell-leg-day 1813 chars (stripped sourceQuote), hypertrophy-12 1773 chars (stripped sourceQuote + form_cues), warmup-3 1185 chars (no strip needed)

#### SC-4 — Invalid URLs Rejected; Error States Honest

**Verdict: PASS**

- `components/extract/UrlInput.tsx:50-57` validates before `onSubmit` — no API call made for invalid URLs
- `INVALID_URL_ERROR` copy at line 27: verbatim from UI-SPEC §7.1
- `aria-invalid="true"` and `aria-describedby="url-error"` at lines 90-91 (accessibility)
- `ErrorState.tsx` implements 4 variants: NETWORK, NO_WORKOUT, RATE_LIMITED, UNKNOWN with distinct copy
- D-13 URL-keyword routing at `lib/extraction/mock.ts:57-89`: `/fail/i` → NETWORK, `/empty/i` → NO_WORKOUT, `/rate-limit/i` → RATE_LIMITED
- D-18 schema-version mismatch handled at `components/extract/ErrorState.tsx:64-66`: "newer version of Exercised" substring → friendly override

#### SC-5 — Zod WorkoutSchema Single Source of Truth with Forward-Looking Fields

**Verdict: PASS**

All forward-looking fields present in `lib/schema/workout.ts`:
- `startTimestamp: z.number().int().nonnegative().nullable()` — line 10 (SCHM-03)
- `sourceQuote: z.string().nullable()` — line 11 (SCHM-03)
- `equipment: z.array(z.string()).default([])` — line 12 (SCHM-03)
- `extraction_confidence: z.enum(["high", "medium", "low"])` — line 39 (SCHM-02)
- `schema_version: z.literal("1")` — line 33 (D-18)
- `difficulty: z.enum(["beginner", "intermediate", "advanced"])` — line 36 (SCHM-04)
- `discriminatedUnion("type", [StandardSetSchema, SupersetSchema])` — line 26 (SCHM-05)

All 5 fixtures parsed via `WorkoutSchema.parse()` at module load (D-14 — `lib/extraction/mock.ts:29-35`). All fixtures contain all forward-looking fields populated (confirmed by inspection of JSON files). 92/92 Vitest tests pass (11 test files) covering schema round-trips, URL parsing, reducer FSM, share encode/decode, clipboard exporters, mock extraction.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/schema/workout.ts` | Zod WorkoutSchema with all forward-looking fields | VERIFIED | All 6 forward-looking fields present; discriminated union; SharePayloadSchema |
| `app/api/extract/route.ts` | POST SSE endpoint with 4 critical headers + EXTRACT_MODE routing | VERIFIED | runtime=nodejs, maxDuration=300, all 4 headers, Zod validation |
| `lib/extraction/service.ts` | ExtractionService interface + factory | VERIFIED | Interface + getExtractionService() reads EXTRACT_MODE |
| `lib/extraction/mock.ts` | 5 fixtures, URL-keyword routing, hash-mod selection | VERIFIED | D-12 hash, D-13 keywords, D-14 module-load validation, D-07 timing |
| `lib/extraction/real.ts` | Phase 2 stub with explicit throw | VERIFIED | Throws "not implemented" — T-01-07 mitigation |
| `components/extract/ExtractFlow.tsx` | useReducer FSM + SSE consumer + share hydration | VERIFIED | 5 states, 6 actions, ?w= mount-effect, TextDecoderStream SSE loop |
| `components/workout/WorkoutView.tsx` | Motion stagger cascade + reduced-motion | VERIFIED | useReducedMotion(), spring {damping:22, stiffness:240}, 65ms stagger |
| `components/workout/ActionBar.tsx` | 4 action buttons + mobile sticky | VERIFIED | Watch/CopyMD/CopyPlain/Share; mobile fixed-bottom with safe-area-inset |
| `lib/share/encode.ts` | D-17 strip chain (sourceQuote→form_cues→equipment) | VERIFIED | MAX_PAYLOAD_BYTES=2048, STRIP_ORDER, best-effort no-throw |
| `lib/share/decode.ts` | 50KB cap + Zod validation + D-18 version mismatch | VERIFIED | All 3 safety layers present |
| `tests/fixtures/*.json` | 5 fixtures covering all layout variants | VERIFIED | All 5 files, all pass WorkoutSchema.parse() at module load |
| `app/globals.css` | Glass-card CSS + reduced-motion master block (7 moments) | VERIFIED | Audit comment + all 7 moments + (hover:hover) guard + mobile fallback |
| `components/extract/ErrorState.tsx` | 4 error variants + D-18 override | VERIFIED | NETWORK/NO_WORKOUT/RATE_LIMITED/UNKNOWN + D18_SUBSTR matching |
| `components/extract/UrlInput.tsx` | Inline validation + aria-invalid + aria-describedby | VERIFIED | Lines 90-91, INPT-02 complete |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExtractFlow.tsx` | `POST /api/extract` | `fetch("/api/extract", {method:"POST"})` at line 73 | WIRED | SSE response consumed via TextDecoderStream |
| `route.ts` | `MockExtractionService` | `getExtractionService()` reads `EXTRACT_MODE` | WIRED | Factory at `lib/extraction/service.ts:16-24` |
| `mock.ts` | `WorkoutSchema` | `WorkoutSchema.parse()` at module load (lines 29-35) | WIRED | Fails fast at import time on schema drift |
| `ExtractFlow.tsx` | `WorkoutView.tsx` | `dispatch({type:"success"})` → renders `<WorkoutView>` | WIRED | Line 175-180 of ExtractFlow |
| `WorkoutView.tsx` | `ActionBar.tsx` | `<ActionBar workout={workout} />` at line 109 | WIRED | ActionBar receives workout prop |
| `ActionBar.tsx` | `lib/share/encode.ts` | `encodeShareUrl(workout)` in handleShare() at line 51 | WIRED | Returns `{encoded, stripped}` |
| `ExtractFlow.tsx` | `lib/share/decode.ts` | `decodeShareUrl(w)` in mount useEffect at line 49 | WIRED | Dispatches hydrate on success |
| `ExtractFlow.tsx` | `ErrorState.tsx` | `state.kind === "error"` → `<ErrorState code={} message={} />` at line 209 | WIRED | All 4 error codes routed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `WorkoutView.tsx` | `workout` prop | `state.workout` dispatched via SSE `result` event | Yes — from fixture via `WorkoutSchema.parse()` | FLOWING |
| `ExtractFlow.tsx` | `state.workout` | `dispatch({type:"success", workout: event.workout})` at line 120 | Yes — Zod-validated from SSE stream | FLOWING |
| `lib/extraction/mock.ts` | `fixture` | `FIXTURES[hashStringMod(seed, FIXTURES.length)]` | Yes — from 5 pre-validated fixtures | FLOWING |
| Share hydration | `workout` (from `?w=`) | `decodeShareUrl(w)` → `SharePayloadSchema.safeParse()` | Yes — lz-decompressed + Zod-validated | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production returns HTTP 200 | `curl -s -o /dev/null -w "%{http_code}" https://exercised-ten.vercel.app` | 200 | PASS |
| SSE streams 4 stage events + result | `curl -sN POST /api/extract ... --max-time 12` | `fetching/transcribing/analyzing/generating/result` all present | PASS |
| SSE `Content-Type` header | curl verbose header check | `text/event-stream; charset=utf-8` | PASS |
| SSE `Cache-Control` header | curl verbose header check | `no-cache, no-transform` | PASS |
| SSE `X-Accel-Buffering` header | curl verbose header check | `no` | PASS |
| Invalid body returns 400 | `curl POST /api/extract -d '{}'` | HTTP 400 | PASS |
| Build succeeds | `pnpm build` | Exit 0; `/` static, `/api/extract` dynamic | PASS |
| 92 Vitest tests pass | `pnpm test --run` | 92/92 passing (11 test files) | PASS |
| SSE stream wall-clock duration | `time curl ...` | 4.592s | NOTED — SC-1 says ~3s; D-07 deliberately 4-5s |

---

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| INPT-01 | 1 | URL input + Enter/CTA submit | SATISFIED | `UrlInput.tsx` lines 75-77 (Enter), `handleSubmit` |
| INPT-02 | 1 | Inline URL validation, aria attributes | SATISFIED | `UrlInput.tsx` lines 90-91, INVALID_URL_ERROR constant |
| INPT-03 | 1 | Tracking param strip | SATISFIED | `lib/youtube/url.ts` parseYouTubeUrl() |
| SCHM-01 | 1 | Single Zod schema source of truth | SATISFIED | `lib/schema/workout.ts` — used by fixtures, route, and UI types |
| SCHM-02 | 1 | Top-level WorkoutSchema fields | SATISFIED | Lines 32-41 of workout.ts |
| SCHM-03 | 1 | Forward-looking per-exercise fields | SATISFIED | ExerciseCoreSchema lines 10-12 |
| SCHM-04 | 1 | difficulty field + chip render | SATISFIED | Line 36 schema; `DifficultyChip.tsx` |
| SCHM-05 | 1 | standard_set + superset discriminated union | SATISFIED | RoutineItemSchema line 26 |
| PIPE-01 | 1 | SSE response with all 5 event types | SATISFIED | route.ts + mock.ts; confirmed production |
| PIPE-02 | 1 | Mock returns same SSE contract | SATISFIED | MockExtractionService matches ExtractEventSchema |
| PIPE-03 | 1 | ~3 seconds pipeline | PARTIAL | ~4.5s actual (D-07 deliberate deviation, user accepted) |
| PIPE-04 | 1 | Loading UI driven by SSE events (not timers) | SATISFIED | D-10: ExtractFlow dispatches stage events; LoadingStages reacts |
| PIPE-05 | 1 | Skeleton cards during loading | SATISFIED | `LoadingStages.tsx` renders 4 SkeletonCards |
| PIPE-06 | 1 | EXTRACT_MODE env var selects service | SATISFIED | `service.ts:17` reads `process.env.EXTRACT_MODE ?? "mock"` |
| OUTV-01 | 1 | Header: title, creator, duration, muscles | SATISFIED | `WorkoutHeader.tsx` lines 33-51 |
| OUTV-02 | 1 | Difficulty chip in header | SATISFIED | `DifficultyChip.tsx` |
| OUTV-03 | 1 | Scrollable exercise list with form-cues toggle | SATISFIED | `ExerciseCard.tsx` with Motion height animation expand |
| OUTV-04 | 1 | Superset bracket grouping | SATISFIED | `SupersetCard.tsx` with accent left-border |
| OUTV-05 | 1 | "Watch on YouTube" link to source video | PARTIAL | Button exists but links to `@creator_username` channel, not source video URL. See Human Verification item 1. |
| OUTV-06 | 1 | AI-disclaimer footer | SATISFIED | `Footer.tsx` lines 9-14 |
| OUTV-07 | 1 | Mobile-responsive, 44px touch targets | SATISFIED | ActionBar mobile sticky-bottom; all buttons h-11 (44px) |
| SHRE-01 | 1 | Copy as Markdown | SATISFIED | `lib/clipboard/markdown.ts`; ActionBar handleCopyMarkdown |
| SHRE-02 | 1 | Copy as Plain Text | SATISFIED | `lib/clipboard/plaintext.ts`; ActionBar handleCopyPlainText |
| SHRE-03 | 1 | Share Workout URL round-trip, schema-version-aware | SATISFIED | encode + decode + D-18 + D-17 strip chain; cross-device smoke approved |
| DSGN-01 | 1 | Dark mode, ambient gradient background | SATISFIED | `html class="dark"` in layout; AmbientBackground 3 orbs |
| DSGN-02 | 1 | Glassmorphism cards | SATISFIED | `.glass-card` CSS; backdrop-blur(16px); 11% opacity |
| DSGN-03 | 1 | Single accent color consistently applied | SATISFIED | `--color-accent: rgb(124 255 107)` neon green across CTAs, rings, active states |
| DSGN-04 | 1 | Geist via next/font, zero CLS | SATISFIED | `geist@1.7.0` npm package; imported in layout.tsx |
| DSGN-05 | 1 | Hover micro-animations; prefers-reduced-motion | SATISFIED (code) / Needs checkbox update | `glass-card:hover` in `globals.css:205-216`; all 7 reduced-motion moments gated; REQUIREMENTS.md checkbox not updated |
| DSGN-06 | 1 | WCAG 4.5:1 contrast | SATISFIED (code) / Needs checkbox update | axe-core 0 violations at HEAD=25cdbe3; opacity:0.6 removed from footer; REQUIREMENTS.md checkbox not updated |
| ERRS-01 | 1 | Invalid URL → inline error, no API call | SATISFIED | UrlInput validates before onSubmit; API call never made |
| ERRS-02 | 1 | Extraction failure → friendly error with retry | SATISFIED | ErrorState NETWORK variant; URL-keyword routing |
| ERRS-03 | 1 | No workout detected → honest empty state | SATISFIED | ErrorState NO_WORKOUT variant; empty URL keyword |
| OPS-01 | 1 | Vercel deploy from main | SATISFIED | Production live at https://exercised-ten.vercel.app |
| OPS-02 | 1 | Mock-mode demo deployed and shareable | SATISFIED | Cross-device smoke test approved by user |
| OPS-03 | 1 | maxDuration = 300 on /api/extract | SATISFIED | `route.ts:12` |

**36 of 36 Phase 1 REQ-IDs accounted for.** OUTV-05 partial (Watch link to channel vs video). PIPE-03 partial (4.5s vs ~3s but intentional per D-07). DSGN-05/DSGN-06 implementation is complete but REQUIREMENTS.md checkboxes remain unchecked.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/extraction/real.ts` | 13 | `throw new Error("Real extraction not implemented")` | Info | Intentional Phase 2 stub — documented and expected |
| `components/extract/ExtractFlow.tsx` | 196-200 | Comment says "URL retained" but actually remounts fresh UrlInput | Info | Known deviation documented in Plan 01-03; minor UX difference |
| `.planning/REQUIREMENTS.md` | DSGN-05/06 rows | Checkboxes show `[ ]` but implementation is complete | Warning | Documentation inconsistency — code is correct, REQUIREMENTS.md traceability not updated after Plan 01-05 |

No `TBD`, `FIXME`, or `XXX` markers found in implementation files (only the intentional `TODO(Plan 01-04)` placeholder which was resolved in Plan 01-04).

---

### Human Verification Required

#### 1. Watch on YouTube Link Destination

**Test:** In the production app, paste a YouTube URL, wait for the workout to render, then click "Watch on YouTube". Observe where the link goes.

**Expected:** Current behavior: link goes to `https://youtube.com/@creator_username` (the creator's YouTube channel). OUTV-05 requires "linking to the source video". SC-1 says only "Watch on YouTube link" (presence, not destination). Decide if the channel link is acceptable for Phase 1 or if OUTV-05 partial should be addressed in Phase 2.

**Why human:** The architectural gap is real — the `Workout` schema has no `video_url` field, and the submitted URL is stored in `lastUrlRef` but not passed to ActionBar. Fixing this requires either (a) adding `video_url` to WorkoutSchema (schema change), or (b) passing the original URL through to ActionBar via props. This is a design decision. Plan 01-02 explicitly deferred this to Phase 4 ("Jump to timestamp" / "Watch source video" polish), but Phase 4 uses `startTimestamp` for jump links, not a general video URL.

---

#### 2. REQUIREMENTS.md Checkboxes for DSGN-05 and DSGN-06

**Test:** Open `.planning/REQUIREMENTS.md` and confirm DSGN-05 and DSGN-06 rows show `- [ ]` (unchecked). Verify the implemented code in `app/globals.css` (lines 196-248) and `components/workout/WorkoutView.tsx` (line 73-76) implements DSGN-05. Verify the axe-core audit result (0 violations, commit 25cdbe3) satisfies DSGN-06.

**Expected:** The implementation satisfies both requirements; the REQUIREMENTS.md checkbox state is stale. Human should decide to update the checkboxes to `[x]` and the traceability table rows from "Pending" to "Complete".

**Why human:** The REQUIREMENTS.md is a planning document, not automatically updated. The git history shows it was last updated in commit 309384a (Plan 01-03 completion). Plan 01-05 updated STATE.md and ROADMAP.md but not REQUIREMENTS.md. This is a docs-only fix but requires human authority to change the file.

---

#### 3. SC-1 Timing Deviation Acceptance

**Test:** Confirm that the ~4.5s production timing for SC-1 ("within ~3 seconds") is accepted as an intentional deviation.

**Expected:** The Discussion Log records the user selecting "4-5s total" during the design discussion. D-07 (CONTEXT.md) documents this decision. The 01-05-SUMMARY.md explicitly notes "renders in ~4-5s per D-07 (confirmed correct behavior)". This should be formally accepted as a deviation to prevent future verifiers from flagging it as a failure.

**Why human:** Only the user can formally accept a deviation from their own stated requirement. The evidence strongly suggests intentional choice, but a formal sign-off closes the loop.

---

### Gaps Summary

No hard blockers found. All 5 success criteria have implementation evidence. The three items in Human Verification are deviations or documentation gaps that need human acceptance, not code failures. The codebase compiles, 92/92 tests pass, and the production URL is live and functional.

**Known stubs (intentional, documented, not blocking):**

1. `lib/extraction/real.ts` — throws "not implemented". Phase 2 resolves this.
2. Watch on YouTube links to `@creator_username` channel, not source video URL. Phase 4 planned (or Phase 2 if prioritized). Schema would need a `video_url` field.

**Documentation gap:**

REQUIREMENTS.md rows for DSGN-05 and DSGN-06 show `[ ]` but the implementation is complete and verified. This is a tracking inconsistency, not a code defect. The file was last updated at Plan 01-03 completion and was not updated when Plan 01-05 closed both requirements.

---

### Deferred Items

Items addressed in later phases per ROADMAP.md:

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-exercise jump-to-timestamp link (`startTimestamp` UI) | Phase 4 | CONTEXT.md `<deferred>` POLI-01 |
| 2 | Source-quote popover per exercise (`sourceQuote` UI) | Phase 4 | CONTEXT.md `<deferred>` POLI-02 |
| 3 | Equipment chips per exercise (`equipment[]` UI) | Phase 4 | CONTEXT.md `<deferred>` POLI-03 |
| 4 | Real extraction pipeline (EXTRACT_MODE=real) | Phase 2 | Phase 2 goal + ROADMAP SC-1 |
| 5 | Rate limiting on /api/extract | Phase 2 | Phase 2 SC-3; ERRS-04 |
| 6 | DMCA/ToS page (OPS-04) | Phase 2 | ROADMAP Phase 2 SC-5 |
| 7 | Daily smoke test (OPS-05) | Phase 2 | ROADMAP Phase 2 SC-5 |
| 8 | Real-device mid-range Android glass-perf validation | Phase 4 | STATE.md deferred items |
| 9 | SSR pre-decode for `?w=` to avoid input-flash | Phase 4 | STATE.md deferred items |
| 10 | dumbbell-leg-day 2089-byte payload | N/A — resolved | Strip chain strips sourceQuote → 1813 chars. Fully handled by D-17 implementation. |

---

## Phase 2 Hand-off Notes

The swap point is `lib/extraction/real.ts`. Set `EXTRACT_MODE=real` in Vercel env vars. The `WorkoutSchema` Zod type is the contract — Phase 2 must produce this exact shape.

**Non-negotiable:** The full cost-protection stack MUST ship in the same PR as the first real OpenAI key per CONTEXT.md Phase 2 Hand-off: Upstash Redis rate limit, Upstash cache, daily spend cap, OpenAI + Vercel budget caps, DMCA page, daily smoke test.

---

_Verified: 2026-05-17T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Production URL: https://exercised-ten.vercel.app (HEAD=17be59f)_
