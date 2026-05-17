# Walking Skeleton — Exercised

**Phase:** 1
**Generated:** 2026-05-17

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user opens the deployed Vercel URL, pastes any YouTube URL into a glass-styled hero, watches four SSE-driven loading stages animate over skeleton cards (~4–5s total), then sees a fully-rendered fixture workout (header + exercise cards + supersets) materialize in a staggered cascade against an ambient gradient orb background — all served from a single `/api/extract` route running a mocked extraction service that emits the same SSE event contract the real backend will use in Phase 2.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.x App Router + TypeScript 5.6+ | Locked by brief; first-class streaming via Route Handlers; RSC + single Client island matches the single-interaction shape of the product (RESEARCH §"Architecture Patterns / Pattern 1") |
| Styling system | Tailwind CSS 4.3.x with `@theme` CSS-first config in `app/globals.css` | Tailwind 4 is CSS-first — no `tailwind.config.ts`; shadcn/ui v3 CSS-variable theme bridges via `@theme inline` block (RESEARCH §"Common Pitfalls / Pitfall 8") |
| Component library | shadcn/ui (CLI-installed source — `button`, `input`, `card`, `skeleton`, `sonner`, `tooltip` only) | Source-level ownership, no version lock-in; Phase 1 installs six primitives total to keep bundle lean (UI-SPEC §8.1) |
| Animation | Motion 12.38.x (`motion/react`) — `AnimatePresence` for stage cascade, variants + stagger for result reveal, `useReducedMotion()` for the master toggle | RESEARCH §"Standard Stack"; brief's "smooth micro-animations + stage cycle" is exactly Motion's sweet spot |
| Typography | Geist 1.7.x npm package — single import, self-hosted woff2, zero CLS, `geist/font/sans` + `geist/font/mono` | CONTEXT.md D-02; one family avoids next/font/google fetch; Mono for `3 × 12 @ 60s rest` tabular numerics (UI-SPEC §3) |
| Data layer | None (no DB, no ORM, no persistence) | v1 is anonymous (PROJECT.md `## Out of Scope`); fixtures live as `tests/fixtures/*.json` parsed at module load via `WorkoutSchema.parse()` (CONTEXT.md D-14) |
| Schema | Zod 4.4.x — single `WorkoutSchema` at `lib/schema/workout.ts` with `z.discriminatedUnion("type", [StandardSetSchema, SupersetSchema])`, `schema_version: z.literal("1")`, and `z.infer` exports for frontend types | Single source of truth for fixtures, mock SSE, future Phase 2 `generateObject(WorkoutSchema)`, and frontend types — eliminates schema drift (ARCHITECTURE §"Pattern 5") |
| API contract | Single `POST /api/extract` Route Handler returning `text/event-stream` from a `ReadableStream`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300` | OPS-03 + Vercel Fluid Compute on by default since 2025-04; single-route gated by `EXTRACT_MODE` env var so Phase 2 swap is service-layer only (RESEARCH §"Pattern 3", ARCHITECTURE Anti-Pattern 2) |
| Mock/real swap | `lib/extraction/service.ts` factory; `getExtractionService()` reads `process.env.EXTRACT_MODE` — `mock` (default) → `MockExtractionService`, `real` → dynamic-imported `RealExtractionService` (Phase 2 only) | Frontend never knows which mode is active; Phase 2 = add one file + flip env var (PIPE-06) |
| State management | React `useReducer` state machine in `<ExtractFlow />` — states: `idle | submitting | streaming | success | error`; actions: `submit | stage | success | error | hydrate | reset` | Five states + ~6 transitions doesn't need Zustand/Redux/XState; no global state outside this island (ARCHITECTURE §"Pattern 2") |
| RSC boundary | One Client island (`<ExtractFlow />`); everything else (Hero markup, `<AmbientBackground />`, `<Footer />`) is RSC | Small client bundle, SEO-friendly first paint; child components (`<WorkoutView />` and below) inherit "use client" because they animate (ARCHITECTURE §"Pattern 1") |
| Share semantics | `?w=<lz-string-compressed-payload>` query param on the homepage route `/`; client-side decode in `useEffect` after mount → dispatch `hydrate` → reducer jumps to `success`; no `/w/[id]` route, no backend round-trip, no localStorage | CONTEXT.md D-15/D-16/D-19; lz-string `compressToEncodedURIComponent` for URL-safe compression; payload is schema-versioned for D-18 forward-compat |
| Deployment target | Vercel from `main` branch via GitHub integration; Fluid Compute on by default; `vercel.json` minimal (only `{ "$schema": "https://openapi.vercel.sh/vercel.json" }`); `EXTRACT_MODE=mock` set in Vercel project env vars (Preview + Production) | OPS-01, OPS-02, OPS-03 |
| Directory layout | `app/` (thin — only `layout.tsx`, `page.tsx`, `globals.css`, `api/extract/route.ts`); `components/extract/`, `components/workout/`, `components/layout/`, `components/ui/` (shadcn); `lib/schema/`, `lib/extraction/`, `lib/sse/`, `lib/youtube/`, `lib/share/`, `lib/clipboard/`; `tests/fixtures/*.json` | Per RESEARCH §"Recommended Project Structure" — `app/` stays thin so all logic in `lib/` is testable without Next.js |
| Package manager | pnpm (CLAUDE.md `## Technology Stack`); Vercel supports natively | Faster installs, deterministic lockfile, monorepo-readiness for Phase 2's optional sidecar |
| Testing | Vitest 1.x for unit tests — Zod schema round-trip against every fixture, share-URL encode/decode round-trip (strip-chain coverage), YouTube URL parser cases | RESEARCH §"Standard Stack / Dev"; fixture-drift fails the build, not production (Pitfall 3 mitigation) |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 16 + TypeScript + Tailwind 4 + ESLint + Prettier + Vitest + pnpm; shadcn init with TypeScript + slate base + CSS variables + RSC + `components/ui` dir per RESEARCH §"Installation")
- [x] Routing — `/` (RSC home page) + `POST /api/extract` (Route Handler, Node runtime, SSE response, `maxDuration = 300`)
- [x] Data layer — None (greenfield, anonymous v1); `tests/fixtures/*.json` parsed via `WorkoutSchema.parse()` at module load is the closest analogue
- [x] UI — Interactive `<ExtractFlow />` Client island: paste-URL → POST `/api/extract` → consume SSE events via `fetch().body.getReader()` + `TextDecoderStream` → render glass-styled workout with cascade animation; copy buttons + share button wired to clipboard / lz-string
- [x] Deployment — Live Vercel URL with one-click rollback from GitHub `main`; share link generated in one browser opens correctly in another

## Out of Scope (Deferred to Later Slices)

The Walking Skeleton (Plan 1) ships the thinnest viable slice. Inside Phase 1, **Plans 2–4** extend that slice to full requirements coverage without altering any architectural decision above. Anything in this list is explicitly NOT in Plan 1:

- **Fixture variety:** Plan 1 ships **only** `dumbbell-leg-day.json` (the brief baseline with one superset). The remaining four fixtures (`bodyweight-push.json`, `full-body-2-supersets.json`, `warmup-3-exercises.json`, `hypertrophy-12-exercises.json`) and the deterministic hash-mod-N selector ship in Plan 2 (CONTEXT.md D-11, D-12).
- **URL-keyword error states (CONTEXT.md D-13):** Plan 1 emits the happy path only. The `fail` / `empty` / `rate-limit` keyword routing in `MockExtractionService` and the corresponding `<ErrorState />` UI variants (UI-SPEC §7.4) ship in Plan 2.
- **Inline URL validation error (ERRS-01):** Plan 1 validates client-side enough to enable/disable the CTA but does not render the full inline error copy from UI-SPEC §7.1; full inline error state ships in Plan 2.
- **Share-link strip chain (CONTEXT.md D-17):** Plan 1 ships share-link encode/decode with the lz-string round-trip and `schema_version` check, but the `>2KB → strip sourceQuote → strip form_cues → strip equipment` fallback chain and the "Share link omits form cues for length" notice ship in Plan 3 (only the 12-exercise fixture exceeds 2KB and that fixture isn't in Plan 1).
- **Mobile glassmorphism perf fallback (UI-SPEC §5.2):** Plan 1 ships the desktop-happy-path glass recipe with `@supports not (backdrop-filter)` fallback only. The `prefers-reduced-motion` + low-memory device branch and real-device validation ship in Plan 4.
- **Full reduced-motion compliance across all 7 motion moments (UI-SPEC §6.5):** Plan 1 ships the global CSS `@media (prefers-reduced-motion: reduce)` block from RESEARCH §"Code Examples / Tailwind 4" and Motion's `useReducedMotion()` on the result cascade. Per-moment refinement (form-cue expansion, toast entrance, focus-ring transitions, pulse-dot, shimmer) ships in Plan 4.
- **axe-core WCAG verification:** Plan 1 ships pre-computed contrast tokens from UI-SPEC §4.2. Automated `axe-core` audit on the deployed gradient ships in Plan 4 (DSGN-06 closure).
- **Sticky-bottom action bar on mobile (UI-SPEC §9.4):** Plan 1 ships the inline desktop `<ActionBar />`. Mobile sticky-bottom variant with `safe-area-inset-bottom` padding ships in Plan 4 (OUTV-07 mobile polish).
- **Tooltip disambiguation on Copy buttons (UI-SPEC §8.1):** Plan 1 ships text-label buttons. Desktop tooltip disambiguation between "Copy as Markdown" / "Copy as Plain Text" (both using `Clipboard` icon) ships in Plan 4.
- **All Phase 2 / Phase 3 requirements:** real captions extraction (EXTR-01..05), GPT-4o `generateObject` calls (EXTR-02..03), cost protections (COST-01..05), eval set (EXTR-04), DMCA page (OPS-04), daily smoke test (OPS-05), low-confidence banner (ERRS-04), audio fallback (EXTR-05, COST-05).

## Subsequent Slice Plan

Each plan in Phase 1 adds one vertical capability on top of the skeleton without altering its architectural decisions:

- **Plan 1 — Walking Skeleton (this plan):** Paste any URL → SSE stages → single `dumbbell-leg-day.json` fixture renders in glass cards with cascade → Copy MD + Copy Plain + Share Workout work (single-fixture, no strip chain) → deployed to Vercel. Validates schema, SSE contract, state machine, mock-real swap, share encode/decode.
- **Plan 2 — Fixture variety + Error/empty/limit states:** Add 4 remaining fixtures (`bodyweight-push.json`, `full-body-2-supersets.json`, `warmup-3-exercises.json`, `hypertrophy-12-exercises.json`); enable deterministic `hash(videoId) mod fixtureCount` selection (D-12); wire URL-keyword error triggers in MockExtractionService (D-13); ship `<ErrorState />` variants for NETWORK/NO_WORKOUT/RATE_LIMITED with copy from UI-SPEC §7.4; full inline URL-validation error from UI-SPEC §7.1.
- **Plan 3 — Save & Share completeness:** Implement the D-17 strip chain (`sourceQuote → form_cues → equipment`) in `lib/share/encode.ts`; surface the "Share link omits form cues for length." notice on toast + on hydrated view (UI-SPEC §11); ship D-18 schema-version error path (`<ErrorState />` variant for newer-version share links); measurement task for compressed payload sizes across all 5 fixtures.
- **Plan 4 — Polish, A11y, Mobile, Final deploy:** Mobile glass fallback recipe (UI-SPEC §5.2); full reduced-motion compliance across all 7 motion moments (UI-SPEC §6.5); axe-core audit against deployed gradient (DSGN-06); sticky-bottom action bar on mobile with safe-area inset (OUTV-07); tooltip disambiguation on Copy buttons (UI-SPEC §8.1); share-link smoke test from a second browser/device; final Vercel production deploy + rollback verification.

Subsequent phases (outside this Phase 1 walking-skeleton scope):

- **Phase 2:** Real captions pipeline (`youtube-caption-extractor` → `generateObject(WorkoutSchema)` with GPT-4o) gated by 5–10 hand-labeled eval set; ships in the same release as the full cost-protection stack (rate limit, cache, daily cap, OpenAI + Vercel budget caps, DMCA page, daily smoke test). Swap is a `lib/extraction/real.ts` add + `EXTRACT_MODE=real` env-var flip — no frontend change.
- **Phase 3:** Audio-transcription fallback for uncaptioned videos via off-Vercel transcript source (Supadata or Railway sidecar) + `gpt-4o-mini-transcribe`; pre-Whisper duration cap.
