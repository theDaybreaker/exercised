# Phase 1: Mock-Deployable Premium UI Demo - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the entire visible product against a mocked extraction pipeline, deployed to Vercel as a public demo URL. Every visible behavior of the product works end-to-end on fixtures: pasting a YouTube URL, the SSE-driven loading animation, the rendered workout view with supersets, copy-to-clipboard, the URL-encoded share link, all error/empty states, and full mobile responsiveness — all wired against a mocked `/api/extract` that emits the same SSE contract the real backend will. The Zod `Workout` schema is locked in this phase including forward-looking fields (`startTimestamp`, `sourceQuote`, `equipment[]`, `extraction_confidence`, `schema_version`, `difficulty`).

**In scope:** Visual design, schema, mock backend with SSE, UI components, share/copy mechanisms, error/empty states, Vercel deployment.

**Out of scope (later phases):** Real captions extraction, GPT-4o calls, rate limiting, caching, OpenAI / Vercel budget caps, audio fallback, DMCA / ToS pages, daily smoke test — all Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Visual Identity

- **D-01:** Accent color is **neon green** (#39FF14 family — exact token tuned during build for WCAG 4.5:1 against glassmorphic surfaces). Single accent across CTAs, focus rings, active stage indicators, and hover-glow.
- **D-02:** Typography is **Geist** as a single body+display family via `next/font` (no Inter/Outfit pairing). Premium feel, zero pairing risk, smallest CSS payload.
- **D-03:** Glassmorphism execution is **subtle premium** — ambient gradient background with 2–3 vibrant color orbs (drifting slowly behind cards), cards at 10–12% white opacity, `backdrop-blur(16px)`, 1px white@10% border. The background does the visual work; cards stay restrained. Aggressive glass and minimalist variants are explicitly rejected.
- **D-04:** Landing-page hero is **single-screen centered composition** — headline + URL input + "Extract Workout" CTA centered on screen, no scroll-revealed marketing sections in v1. Ambient orbs carry the visual interest before the user pastes.
- **D-05:** Motion respects `prefers-reduced-motion`: gradient orbs go static, stage-cycle dissolves cross-fade only, card hover-lift disabled.

### Loading Choreography

- **D-06:** Stage labels are the **brief's exact copy**: "Fetching video data…" → "Transcribing audio…" → "Analyzing form cues…" → "Generating routine…" (sentence case, ellipses, energetic but professional).
- **D-07:** Mock total duration is **~4–5s** (each stage ~1.0–1.2s) — slower than the brief's 3s. Gives each label time to be read; sets a non-rushed expectation that real backend can meet.
- **D-08:** Result reveal is **all-at-once with staggered cascade** — loading view dissolves, workout header fades in first, then exercise cards cascade in (50–80ms stagger). Backend (mock and real) emits a single `result` event carrying the full Workout. **No progressive per-exercise streaming** in v1 — keeps components from needing partial-state handling.
- **D-09:** Stage UI: single active stage label with a subtle pulse on the indicator dot, previous-stage checkmarks rendered as small icons beside it, and 3–4 skeleton workout cards visible below the active stage. User always sees what's coming.
- **D-10:** Stage transitions in the mock are **timer-driven internally but emitted as SSE events** — the UI consumes events, never timers. This makes the swap to real backend mechanical (real backend emits the same events, just sourced from pipeline progress).

### Mock Fixture Strategy

- **D-11:** **5–6 varied fixtures** ship in `tests/fixtures/`:
  1. The brief's "Dumbbell Only Leg Day" (baseline, has one superset)
  2. Bodyweight Push Day — no supersets, exercises UI without bracket grouping
  3. Full-Body with 2 supersets — exercises supersets-of-supersets rendering edge
  4. Short 3-exercise Warmup — exercises low-content layout
  5. Long 12-exercise Hypertrophy — exercises scroll, dense list, mobile reflow
- **D-12:** **URL → fixture is deterministic via hash** — `hash(videoId) mod fixtureCount` picks the fixture for any real YouTube URL. Same URL = same fixture. Preserves share-link consistency across pastes of the same URL.
- **D-13:** **Error/empty states triggered by URL keywords** — URLs containing `fail` → network/server error, `empty` → no-workout-detected state, `rate-limit` → rate-limited state. Special demo URLs let designers and reviewers exercise every state without code changes.
- **D-14:** Fixtures live as `tests/fixtures/*.json` files (not inline TS constants) and are **parsed via `WorkoutSchema.parse()` at app boot** (or first request, whichever the architecture chooses). Schema drift fails fast at the contract boundary — fixtures stay valid as the schema evolves.

### Routing & Share Semantics

- **D-15:** Architecture is **single-page state machine** on route `/`. A `useReducer` manages `idle → submitting → streaming → success | error` transitions. **No `/w/[id]` output route.** One client island owns the state machine; the rest of the page is RSC.
- **D-16:** Share link uses **query-param hydration** — `?w=<lz-string-compressed-payload>` on the homepage. On mount, the client detects the param, decompresses, validates against `WorkoutSchema`, and jumps the state machine directly to `success`. No re-extraction. No network call. Refresh on a shared URL works correctly.
- **D-17:** **Long-workout fallback:** if `lz-string(workout)` compressed payload exceeds **2KB**, strip optional fields from the share payload in this order: `sourceQuote`, `form_cues`, `equipment[]` — keeping name, sets, reps, rest, supersets, header. UI surfaces a single-line notice on the share success toast: "Share link omits form cues for length."
- **D-18:** **Share URL is schema-versioned** — payload includes `schema_version` from the locked schema. If a recipient opens a share URL with a future-incompatible schema version, the app shows an honest error: "This share link was created with a newer version of Exercised — try pasting the original YouTube URL instead." Same-version older links always work.
- **D-19:** **Refresh behavior (no share param):** state machine resets to `idle` — the workout view was ephemeral. Pairs with a subtle nudge after extraction completes: "Use Share to save this view." No localStorage caching of workouts in v1 (avoids stale-schema problems and keeps the model honest).

### Claude's Discretion

- Exact accent-green hex token (within the #39FF14 family) and its WCAG-tuned variants on glassmorphic surfaces.
- Gradient orb color palette (other than the green accent — the secondary orb colors should complement, not compete).
- Card stagger animation timing (50–80ms range) and spring vs. ease curve choice — pick by feel during implementation.
- Specific YouTube creators / video titles inside the fixtures — should feel realistic (real-looking @creator names, plausible video titles) without copying any specific real creator's identity.
- Whether share-link nudge is a toast vs. inline-below-CTA — pick by visual balance.
- Exact mobile breakpoints for the hero layout reflow.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — What This Is, Core Value, Active requirements (Phase 1 scope), Constraints (Tech stack, Design fidelity), Key Decisions.
- `.planning/REQUIREMENTS.md` — All 49 v1 REQ-IDs; Phase 1 covers 36 of them. Traceability table shows which REQs map here.
- `.planning/ROADMAP.md` §"Phase 1: Mock-Deployable Premium UI Demo" — Goal, success criteria (5), `Mode: mvp`, requirements list.
- `.planning/STATE.md` — Current focus, accumulated decisions from project init, Phase 1 blocker note about glassmorphism mobile-performance testing.

### Research (project-level, completed during init)
- `.planning/research/SUMMARY.md` — Executive summary, recommended stack, expected features, architecture approach, top-5 pitfalls; phase-by-phase roadmap implications.
- `.planning/research/STACK.md` — Prescriptive 2026 stack: Next.js 16, Tailwind 4, shadcn/ui, Motion 12, Geist font, Zod 4, `next/font`. Verified npm versions, rationale, what NOT to use.
- `.planning/research/FEATURES.md` — Table-stakes vs. differentiator vs. anti-feature categorization. Schema-level forward-looking fields (startTimestamp, sourceQuote, equipment, difficulty) flagged as Phase 1 must-haves.
- `.planning/research/ARCHITECTURE.md` — Component breakdown, RSC + single Client island, `useReducer` state machine, mock-vs-real swap via service interface, Zod single source of truth, file/folder layout, build order. **Most important read for Phase 1 planning.**
- `.planning/research/PITFALLS.md` §"Pitfall #6 (glassmorphism)" and §"Pitfall #7 (fake loading states)" — directly relevant; mitigations baked into D-03/D-06/D-10.

### Brief / contract
- The user's original brief (captured in PROJECT.md `## What This Is` + `## Active Requirements`) — JSON schema example for `Workout`, mock API contract (`/api/extract` returns the JSON after 3s delay), pipeline stage labels, visual aesthetic spec.

### No external code yet
- Greenfield project. No prior CONTEXT.md, no codebase to reuse, no `.planning/codebase/` maps. Phase 1 *creates* the patterns the rest of the project will follow — every decision here becomes a load-bearing convention.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **None — this is a fresh repo.** Phase 1 is the foundation. Components, hooks, conventions, and patterns established here become the templates for Phases 2–3 and any future work.

### Established Patterns

- **None yet.** Phase 1 establishes:
  - Zod schema location and naming (`lib/schema/workout.ts`)
  - Component naming (`<ExtractFlow />` as the single Client island; `<WorkoutView />`, `<ExerciseCard />`, `<SupersetCard />` as render components)
  - State management (`useReducer` state machine, no Zustand/Redux)
  - Mock-vs-real backend swap (`ExtractionService` interface with `MockExtractionService` and `RealExtractionService` implementations, gated by `EXTRACT_MODE` env var)
  - SSE event contract (`fetching`, `transcribing`, `analyzing`, `generating`, `result`, `error`)
  - Fixture loading (`tests/fixtures/*.json` parsed via `WorkoutSchema` at boot)

### Integration Points

- **Vercel Functions** — `/api/extract` route handler with `export const maxDuration = 300` (Fluid Compute).
- **next/font** — Geist loaded via `next/font/google` with appropriate `display: 'swap'` and zero-CLS preload.
- **shadcn/ui** — Initialize via `npx shadcn@latest init`, pick `slate` base + custom CSS vars for the neon-green accent, dark-mode default.
- **Tailwind 4** — CSS-first config; `@theme` block holds design tokens.
- **`lz-string`** — npm dependency; used in the share-URL roundtrip on both encode and decode sides.

</code_context>

<specifics>
## Specific Ideas

- **Exact JSON shape compatibility:** the user's brief specified a literal example JSON. The locked `WorkoutSchema` must accept that example unchanged (byte-compatible after Zod parse).
- **The brief specified copy verbatim** for the loading stages — those words ship as-is (D-06).
- **The brief specified "centered input field" and "massive, enticing 'Extract Workout' button"** — "massive" is taken literally; the CTA is the focal point of the hero composition (D-04).
- **The brief said "scrollable list of exercises"** — confirms the workout view should not paginate exercise cards.
- **Research recommended Geist over Inter/Outfit** — user accepted this divergence from the brief (D-02). The brief's "or Outfit" suggested Geist-class fonts were directionally correct; Geist just executes the same intent better.
- **Subtle premium glass + ambient gradient bg** — directly addresses Pitfall #6 from research; the user-validated path away from "2014 Dribbble" glassmorphism.

</specifics>

<deferred>
## Deferred Ideas

Captured during discussion but belong to other phases or v2+.

- **Per-exercise jump-to-timestamp link** — `startTimestamp` is in the schema in Phase 1, but the rendered `↪ jump to 2:14` UI ships in Phase 4 (Trust + Polish). Already in REQUIREMENTS.md as `POLI-01`.
- **Source-quote popover per exercise** — `sourceQuote` is in the schema in Phase 1, but the popover renders in Phase 4. Already in REQUIREMENTS.md as `POLI-02`.
- **Equipment chips per exercise** — `equipment[]` schema field locked in Phase 1; rendering deferred to Phase 4. Already in REQUIREMENTS.md as `POLI-03`.
- **localStorage of recently-extracted URLs** — explicitly rejected for v1 refresh behavior (D-19). Deferred as Phase 4 polish (already in REQUIREMENTS.md as `POLI-07`).
- **`/preview` design-system route showing all UI states** — discussed but not selected (D-13 used URL keywords instead). Could be added as developer affordance in a future phase if design review becomes a recurring need.
- **Cached-extraction UX with "⚡ Cached" badge** — depends on Phase 2's cache layer existing. Already in REQUIREMENTS.md as `POLI-08`.
- **Sample-workouts preview strip on the landing page** — rejected for v1 hero (D-04). Could be a v1.1 enhancement once real fixtures exist from analytics.
- **Mobile-glass perf fallback (reduced opacity, no backdrop-filter on low-power devices)** — flagged in STATE.md "Blockers/Concerns". Phase 1 *plans* for this but defers full implementation to a performance pass if real-device testing flags it.

</deferred>

---

*Phase: 1-Mock-Deployable Premium UI Demo*
*Context gathered: 2026-05-17*
