# Phase 1: Mock-Deployable Premium UI Demo - Research

**Researched:** 2026-05-17
**Domain:** Next.js 16 + Tailwind 4 + shadcn/ui + Motion 12 greenfield app shipping a mock-backed premium UI demo, deployed to Vercel Fluid Compute
**Confidence:** HIGH on stack patterns, route-handler SSE, Zod schema, Motion 12 API, Tailwind 4 @theme, Vercel Fluid Compute defaults; MEDIUM on `backdrop-filter` mobile-perf detection (multiple valid feature-detection strategies, real-device testing required); MEDIUM on exact lz-string payload sizes for the 12-exercise fixture (must be measured at fixture build time).

## Summary

Phase 1 is greenfield. It establishes every load-bearing convention for Phases 2–3: schema location, component naming, state-machine shape, mock-vs-real swap pattern, SSE event contract, fixture-load discipline, design-token system, glass recipe, motion contract. The user-decided CONTEXT.md and UI-SPEC.md have already converged on a prescriptive set of choices — this research is **not** exploratory. Its job is to verify those choices against current (May 2026) library APIs, surface concrete code shapes the planner can convert directly into tasks, and pre-empt the integration gotchas that would otherwise surface as wasted plan-checker/code-review cycles.

Five decisions drive the whole phase: (1) **single `/api/extract` route** returning `text/event-stream` from a `ReadableStream`, gated by `EXTRACT_MODE`; (2) **single Client island `<ExtractFlow />`** owning a `useReducer` state machine, rest of the page is RSC; (3) **one Zod schema at `lib/schema/workout.ts`** with a `z.discriminatedUnion("type", [StandardSetSchema, SupersetSchema])` and `schema_version` literal embedded; (4) **Tailwind 4 `@theme` block in `app/globals.css`** as the only place design tokens live — no `tailwind.config.ts`; (5) **Motion 12 `AnimatePresence` + `staggerChildren: 0.065`** for the result cascade, `useReducedMotion()` hook for the master toggle.

**Primary recommendation:** Plan the phase as a strict topological build order — schema + fixtures first (Wave 0), then mock SSE + route handler (Wave 1), then UI shell + state machine (Wave 2), then result render + share/copy (Wave 3), then deploy (Wave 4). The schema and SSE contract are load-bearing for every subsequent task; getting them wrong forces rework in three places (mock, real backend Phase 2, frontend type inference). Every greenfield task starts from `pnpm create next-app` with explicit flag set documented below.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Visual Identity**
- **D-01:** Accent color is **neon green** (#39FF14 family — exact token tuned during build for WCAG 4.5:1 against glassmorphic surfaces). Single accent across CTAs, focus rings, active stage indicators, and hover-glow.
- **D-02:** Typography is **Geist** as a single body+display family via `next/font` (no Inter/Outfit pairing). Premium feel, zero pairing risk, smallest CSS payload.
- **D-03:** Glassmorphism execution is **subtle premium** — ambient gradient background with 2–3 vibrant color orbs (drifting slowly behind cards), cards at 10–12% white opacity, `backdrop-blur(16px)`, 1px white@10% border. The background does the visual work; cards stay restrained. Aggressive glass and minimalist variants are explicitly rejected.
- **D-04:** Landing-page hero is **single-screen centered composition** — headline + URL input + "Extract Workout" CTA centered on screen, no scroll-revealed marketing sections in v1. Ambient orbs carry the visual interest before the user pastes.
- **D-05:** Motion respects `prefers-reduced-motion`: gradient orbs go static, stage-cycle dissolves cross-fade only, card hover-lift disabled.

**Loading Choreography**
- **D-06:** Stage labels are the brief's exact copy: "Fetching video data…" → "Transcribing audio…" → "Analyzing form cues…" → "Generating routine…" (sentence case, ellipses, energetic but professional).
- **D-07:** Mock total duration is **~4–5s** (each stage ~1.0–1.2s) — slower than the brief's 3s. Gives each label time to be read; sets a non-rushed expectation that real backend can meet.
- **D-08:** Result reveal is **all-at-once with staggered cascade** — loading view dissolves, workout header fades in first, then exercise cards cascade in (50–80ms stagger). Backend (mock and real) emits a single `result` event carrying the full Workout. **No progressive per-exercise streaming** in v1.
- **D-09:** Stage UI: single active stage label with a subtle pulse on the indicator dot, previous-stage checkmarks rendered as small icons beside it, and 3–4 skeleton workout cards visible below the active stage. User always sees what's coming.
- **D-10:** Stage transitions in the mock are **timer-driven internally but emitted as SSE events** — the UI consumes events, never timers.

**Mock Fixture Strategy**
- **D-11:** **5–6 varied fixtures** ship in `tests/fixtures/`: Dumbbell-Only Leg Day (baseline + 1 superset), Bodyweight Push (no supersets), Full-Body 2 supersets, Warmup 3 exercises, Hypertrophy 12 exercises.
- **D-12:** **URL → fixture is deterministic via hash** — `hash(videoId) mod fixtureCount` picks the fixture for any real YouTube URL. Same URL = same fixture.
- **D-13:** **Error/empty states triggered by URL keywords** — URLs containing `fail` → network/server error, `empty` → no-workout-detected, `rate-limit` → rate-limited.
- **D-14:** Fixtures live as `tests/fixtures/*.json` files (not inline TS constants) and are **parsed via `WorkoutSchema.parse()` at app boot** (or first request). Schema drift fails fast.

**Routing & Share Semantics**
- **D-15:** Architecture is **single-page state machine** on route `/`. A `useReducer` manages `idle → submitting → streaming → success | error` transitions. **No `/w/[id]` output route.** One client island owns the state machine; rest of the page is RSC.
- **D-16:** Share link uses **query-param hydration** — `?w=<lz-string-compressed-payload>` on the homepage. On mount, the client detects the param, decompresses, validates against `WorkoutSchema`, jumps directly to `success`. No re-extraction. No network call.
- **D-17:** **Long-workout fallback:** if `lz-string(workout)` compressed payload exceeds **2KB**, strip optional fields from the share payload in this order: `sourceQuote`, `form_cues`, `equipment[]` — keeping name, sets, reps, rest, supersets, header. UI surfaces a single-line notice: "Share link omits form cues for length."
- **D-18:** **Share URL is schema-versioned** — payload includes `schema_version` from the locked schema. Future-incompatible version → honest error: "This share link was created with a newer version of Exercised — try pasting the original YouTube URL instead." Same-version older links always work.
- **D-19:** **Refresh behavior (no share param):** state machine resets to `idle` — the workout view was ephemeral. Paired with subtle nudge after extraction: "Use Share to save this view." No localStorage caching in v1.

### Claude's Discretion

- Exact accent-green hex token (within the #39FF14 family) and its WCAG-tuned variants on glassmorphic surfaces. UI-SPEC.md §4 settled on **`#7CFF6B`** (WCAG-tuned) — planner can use directly.
- Gradient orb color palette (secondary orbs complement, not compete). UI-SPEC.md §5.1 settled on green (`rgba(124,255,107,…)`), violet (`rgba(139,92,246,…)`), coral (`rgba(255,138,76,…)`).
- Card stagger animation timing (50–80ms range) and spring vs. ease curve choice. UI-SPEC.md §6.2 settled on **65ms stagger with spring** `{ damping: 22, stiffness: 240 }`.
- Specific YouTube creators / video titles inside the fixtures — should feel realistic without copying real creators. UI-SPEC.md §10 settled on plausible synthetic handles (`@kynanfit`, `@anatomywithash`, `@coachvee`). Final names due in Plan 1.
- Whether share-link nudge is a toast vs. inline-below-CTA — pick by visual balance. UI-SPEC.md §7.3 settled on **both** (toast on share success, inline below CTAs on every successful workout view).
- Exact mobile breakpoints for the hero layout reflow. UI-SPEC.md §9.1 settled on **`md: 768px`** as the single layout breakpoint.

### Deferred Ideas (OUT OF SCOPE)

- Per-exercise jump-to-timestamp link (`POLI-01`) — `startTimestamp` IS in the Phase 1 schema; rendering ships in Phase 4.
- Source-quote popover per exercise (`POLI-02`) — `sourceQuote` IS in the Phase 1 schema; popover ships in Phase 4.
- Equipment chips per exercise (`POLI-03`) — `equipment[]` IS in the Phase 1 schema; rendering ships in Phase 4.
- localStorage of recently-extracted URLs (`POLI-07`) — explicitly rejected for v1 refresh behavior.
- `/preview` design-system route — D-13 used URL keywords instead.
- Cached-extraction UX with "⚡ Cached" badge (`POLI-08`) — depends on Phase 2 cache layer.
- Sample-workouts preview strip on landing page — rejected for v1 hero.
- Mobile-glass perf fallback **full validation** — Phase 1 *implements* the fallback (UI-SPEC §5.2), but real-device validation on mid-range Android is deferred to a perf pass if BrowserStack flags it.
- All Phase 2/3 requirements: real extraction (EXTR-01..05), cost protections (COST-01..05), DMCA page (OPS-04), daily smoke test (OPS-05), low-confidence banner (ERRS-04).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INPT-01 | URL input + "Extract Workout" CTA, submit via Enter or click | UI-SPEC §7.1 copy locked; component `<UrlInput />` (§8.2); shadcn `input` + custom `button` size="large" (§8.1) |
| INPT-02 | Client-side YouTube URL validation + inline error before submit | UI-SPEC §7.1 error copy locked; regex pattern: `^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=\|shorts\/)\|youtu\.be\/)([A-Za-z0-9_-]{11})` (Verify in Plan task) |
| INPT-03 | Clipboard paste with auto-trim of whitespace/tracking params | Strip `?si=`, `?feature=`, `?t=`, `&list=`, `&index=`, etc.; `String.prototype.trim()` on paste handler |
| SCHM-01 | Single Zod schema at `lib/schema/workout.ts` as source of truth | See Code Examples §Zod Schema below; `z.infer` produces frontend types |
| SCHM-02 | Top-level fields: workout_title, creator_username, target_muscles[], estimated_duration_mins, routine[], extraction_confidence, schema_version | Schema literal type `schema_version: z.literal("1")` enables D-18 versioning |
| SCHM-03 | Each exercise (standard + within superset) carries startTimestamp, sourceQuote, equipment[] | Optional fields with `.optional()` in Zod 4 (rendered behavior deferred to Phase 4 but schema-locked here) |
| SCHM-04 | Workout-level difficulty field (beginner/intermediate/advanced) | `z.enum(["beginner", "intermediate", "advanced"])`; UI-SPEC §4.1 accent-chip rules |
| SCHM-05 | Standard_set and superset routine entry types, byte-compatible with brief example | `z.discriminatedUnion("type", [StandardSetSchema, SupersetSchema])` — see Code Examples |
| PIPE-01 | `/api/extract` returns text/event-stream emitting fetching → transcribing → analyzing → generating → result\|error | See Code Examples §SSE Route; `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` |
| PIPE-02 | Mock implementation returns fixture JSON via same SSE events; real-backend swap is service-layer | `getExtractionService()` factory reads `EXTRACT_MODE` env var; identical AsyncIterable<ExtractEvent> contract |
| PIPE-03 | Mock pipeline completes in ~3s with visible stage transitions | D-07 overrides to 4–5s — planner uses D-07 (5s slower-than-brief is correct); per-stage delay 1.0–1.2s |
| PIPE-04 | Loading UI driven by real SSE events (not faked setTimeout); 300ms min dwell per stage | Min dwell enforced **inside MockExtractionService** (server-side), not in UI reducer (PITFALLS §7) |
| PIPE-05 | Loading state shows skeleton workout cards in addition to stage label | UI-SPEC §6.1 — 4 skeleton cards below stage list; shimmer disabled under reduced motion |
| PIPE-06 | `EXTRACT_MODE` env var selects mock vs real ExtractionService at runtime | Frontend never knows; service factory dynamic-imports the implementation per env |
| OUTV-01 | Output renders workout title, creator, duration, target-muscle pills, header | UI-SPEC §7.3 copy locked; components `<WorkoutHeader />`, `<MusclePill />`, `<DurationChip />` |
| OUTV-02 | Difficulty chip (beginner/intermediate/advanced) renders in header | UI-SPEC §4.1 accent rules — beginner muted, intermediate/advanced accent |
| OUTV-03 | Exercise list scrollable; each standard_set rendered as card with name, sets, reps, rest, expandable form cues | `<ExerciseCard />`; UI-SPEC §6.4 form-cue expansion motion; Geist Mono for `3 × 12 @ 60s rest` |
| OUTV-04 | Superset entries render as bracketed card with inner exercises + shared rest indicator | `<SupersetCard />`; UI-SPEC §7.3 "Superset · rest {N}s" label |
| OUTV-05 | "Watch on YouTube" link/button visible on output | UI-SPEC §7.3 copy; `lucide-react` `ExternalLink` icon; `target="_blank" rel="noopener noreferrer"` |
| OUTV-06 | Footer-level AI-disclaimer | UI-SPEC §7.1 + §7.3 — same copy in both states |
| OUTV-07 | Fully mobile-responsive — 44px min touch target, cards reflow on phone widths | UI-SPEC §9.5 — `h-11 w-11` icon-only, `h-14` CTA, sticky-bottom action bar on mobile |
| SHRE-01 | "Copy as Markdown" copies workout as readable markdown | Util function `workoutToMarkdown(workout): string`; `navigator.clipboard.writeText()` |
| SHRE-02 | "Copy as Plain Text" copies plain-text variant suitable for Notes/WhatsApp | Util function `workoutToPlainText(workout): string`; same clipboard API |
| SHRE-03 | "Share Workout" generates URL-encoded share link (lz-string compressed), schema-version-aware, no backend round-trip | `compressToEncodedURIComponent` produces URL-safe string; D-17 strip chain enforced; D-18 versioning |
| DSGN-01 | Dark-mode default with ambient gradient background (vibrant orbs, not flat black) | UI-SPEC §5.1 recipe — 3 drifting orbs, `#08090C` base (not pure black per PITFALLS §6) |
| DSGN-02 | Cards use glassmorphism — semi-translucent, backdrop-blur, thin 10% white border, 10–15% opacity | UI-SPEC §5.2 `.glass-card` recipe — `rgba(255,255,255,0.11)` bg, `blur(16px) saturate(140%)`, `border-radius: 16px` |
| DSGN-03 | Single accent (neon green) applied to CTAs, focus rings, active stage indicators | UI-SPEC §4.1 reserved-for list — exactly 6 use cases, never headings/body |
| DSGN-04 | Typography uses Geist via `next/font` with zero CLS | `geist@1.7.0` npm package — self-hosted woff2; import `GeistSans` from `geist/font/sans`, `GeistMono` from `geist/font/mono`; no `next/font/google` config needed |
| DSGN-05 | Micro-animations on hover (cards lift/glow) and stage transitions; respects prefers-reduced-motion | UI-SPEC §5.3 + §6.5 — `useReducedMotion()` hook from `motion/react` is master toggle |
| DSGN-06 | WCAG 4.5:1 contrast on all body text against glassmorphic backgrounds | UI-SPEC §4.2 ratios pre-computed; `axe-core` verification task in plan |
| ERRS-01 | Invalid URL → inline form error, no API call made | UI-SPEC §7.4 row 1; `aria-invalid="true"` + `aria-describedby` |
| ERRS-02 | Extraction failure → friendly error state with retry CTA, distinct copy per failure reason | URL keyword `fail` triggers mock to emit `error: NETWORK`; UI-SPEC §7.4 row 2 |
| ERRS-03 | No workout detected → honest empty state, not fabricated content | URL keyword `empty` triggers mock to emit `error: NO_WORKOUT`; UI-SPEC §7.4 row 3 |
| OPS-01 | App deploys to Vercel from main with one-click rollback | Vercel Hobby tier; `vercel.json` minimal (likely empty or `{ "fluid": true }` — see Validation below); GitHub integration for auto-deploy |
| OPS-02 | Mock-mode demo deployed and shareable end of Phase 1 | This is the phase exit gate; `EXTRACT_MODE` unset or `EXTRACT_MODE=mock` in production env vars |
| OPS-03 | `/api/extract` uses Vercel Fluid Compute with `maxDuration = 300` | Fluid Compute on by default since 2025-04 for new projects; `export const maxDuration = 300` in route.ts |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Landing-page shell (hero copy, footer, ambient background mount) | Frontend Server (RSC) | — | No interactivity; ships zero JS for static markup; SEO-friendly |
| URL input + state machine + SSE consumption | Browser / Client | — | `useReducer`, `fetch().body.getReader()`, `EventSource`-like loop must run in browser |
| `/api/extract` route handler | API / Backend (Node runtime, Fluid Compute) | — | Returns `ReadableStream` of SSE events; service factory; `maxDuration = 300` |
| Mock extraction service (timed SSE event emission + fixture parse) | API / Backend | — | Runs inside route handler process; never crosses to client |
| Fixture JSON files | Static / Build-time | API / Backend (load at module init) | Files live in `tests/fixtures/*.json`; imported by mock service via Node `fs` or `import` |
| Workout view rendering (cards, supersets, header) | Browser / Client (CC, no state) | — | Motion animations require Client Component; pure render from props |
| Copy-to-clipboard (Markdown / Plain Text) | Browser / Client | — | `navigator.clipboard.writeText()` is browser API |
| Share link generation (`lz-string` encode) | Browser / Client | — | Computed on click from in-memory `Workout` object; no backend roundtrip |
| Share link hydration (on mount) | Browser / Client | — | `?w=` decode runs in `<ExtractFlow />` mount-effect; jumps reducer to `success` |
| Static assets (Geist woff2, lucide icons) | CDN / Static | — | `next/font` + bundler; Vercel edge-cached by default |
| Glassmorphism + animations | Browser / Client | — | `backdrop-filter`, Motion transforms, CSS variables; pure rendering layer |

## Project Constraints (from CLAUDE.md)

CLAUDE.md is the project's CLAUDE.md, embedding PROJECT.md, STACK.md, CONVENTIONS.md, and ARCHITECTURE.md. Active directives:

- **Tech stack locked:** Next.js (App Router) + TypeScript + Tailwind CSS + Vercel + shadcn/ui — confirmed.
- **Scope discipline:** No auth, no DB, no tracker in v1. Every "what if we also…" answer is out of scope.
- **Design fidelity:** Premium aesthetic is core value, not paint. Glassmorphism, motion, type choices are non-negotiable.
- **Package manager:** **pnpm** (CLAUDE.md `## Technology Stack` notes pnpm for faster installs, monorepo readiness; Vercel supports natively).
- **Linting/formatting:** ESLint via `eslint-config-next`; Prettier + `prettier-plugin-tailwindcss` for canonical Tailwind class ordering — non-negotiable when class strings get long with glassmorphism utilities.
- **Testing:** Vitest for unit tests — Zod schema round-trip tests against fixture JSON specifically called out.
- **Conventions:** Section currently empty — Phase 1 *establishes* these conventions for Phases 2–3.

## Standard Stack

### Core (verified via `npm view <pkg> version` on 2026-05-17)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.6 | Framework + Route Handlers | `[VERIFIED: npm registry]` `[CITED: nextjs.org/docs/app/api-reference/file-conventions/route]` Locked by brief; current `latest` dist-tag |
| `react` | 19.x (auto via Next 16) | UI runtime | `[VERIFIED: shipped-with-next]` Next 16 ships with React 19 |
| `typescript` | 5.6+ | Type safety | `[CITED: STACK.md]` Required for Zod 4 inference |
| `tailwindcss` | 4.3.0 | Styling | `[VERIFIED: npm registry]` `[CITED: tailwindcss.com/docs/theme]` Locked by brief; v4 CSS-first config aligns with shadcn |
| `zod` | 4.4.3 | Schema | `[VERIFIED: npm registry]` `[CITED: zod.dev/api]` Source-of-truth schema; `discriminatedUnion` works on 4.x |
| `motion` | 12.38.0 | Animation | `[VERIFIED: npm registry]` `[CITED: motion.dev/docs]` Rebranded framer-motion; `AnimatePresence`, `useReducedMotion`, variants/stagger |
| `geist` | 1.7.0 | Typography (Sans + Mono) | `[VERIFIED: npm registry]` `[CITED: vercel/geist-font GitHub repo + npm package readme]` Self-hosted woff2; `geist/font/sans`, `geist/font/mono` exports |
| `lz-string` | 1.5.0 | Share-URL compression | `[VERIFIED: npm registry]` `[CITED: github.com/pieroxy/lz-string]` `compressToEncodedURIComponent` produces URL-safe output |
| `lucide-react` | 1.16.0 | Icon set | `[VERIFIED: npm registry]` shadcn/ui default icons |
| `clsx` | 2.1.1 | Class-name composition | `[VERIFIED: npm registry]` Half of the `cn()` helper |
| `tailwind-merge` | 3.6.0 | Tailwind class deduping | `[VERIFIED: npm registry]` Other half of `cn()` |
| `sonner` | 2.0.7 | Toast notifications | `[VERIFIED: npm registry]` `[CITED: shadcn-ui registry]` shadcn-blessed; "Copied to clipboard" toasts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-tooltip` | 1.2.8 | Tooltip primitive | `[VERIFIED: npm registry]` Installed via `npx shadcn@latest add tooltip`; disambiguates Copy-MD vs Copy-Plain icons on desktop |
| `next-themes` | 0.4.6 | Theme provider (dark fixed) | `[VERIFIED: npm registry]` Future-proofs for v1.1 light mode toggle; dark hardcoded in v1 |

### Dev / Tooling

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `pnpm` | latest | Package manager | `[CITED: STACK.md]` `[ASSUMED: project convention]` Per CLAUDE.md |
| `vitest` | latest | Unit tests | `[CITED: STACK.md]` Zod schema round-trip tests against fixtures (Phase 1) |
| `prettier` + `prettier-plugin-tailwindcss` | latest | Formatting / class sort | `[CITED: STACK.md]` Non-negotiable for long glass utility chains |
| `eslint-config-next` | bundled with Next 16 | Linting | Bundled with `create-next-app` |

### Alternatives Considered (already settled)

| Instead of | Could Use | Tradeoff (why we don't) |
|------------|-----------|--------------------------|
| `useReducer` | Zustand / Redux | Five states, ~6 transitions, no global state need. Dependency cost without benefit. `[CITED: ARCHITECTURE.md Pattern 2]` |
| Single `/api/extract` + service factory | Two routes (`/api/extract-mock`, `/api/extract`) | Frontend would know which mode is active; every env reconfigured at two layers. `[CITED: ARCHITECTURE.md Anti-Pattern 2]` |
| SSE in one stream | POST + job ID + polling | Adds state store, two endpoints, polling loop. ~30s extraction fits 300s Fluid Compute easily. `[CITED: ARCHITECTURE.md Pattern 4]` |
| Single Zod schema + `z.infer` types | Hand-written TS interface + separate Zod schema | They drift. `[CITED: ARCHITECTURE.md Anti-Pattern 4]` |
| `lz-string` `compressToEncodedURIComponent` | Plain `encodeURIComponent(JSON.stringify(w))` | A 10-exercise workout JSON is ~3–6 KB raw; lz-string compresses ~40–70%. Without compression we'd hit 2KB cap on the 12-exercise fixture immediately. `[CITED: github.com/pieroxy/lz-string]` |
| `lz-string` `compressToEncodedURIComponent` | `compressToBase64` + manual URL-encode | The URI-safe variant already escapes `+`/`/` to URL-safe chars; manual encode adds bytes. `[CITED: pieroxy.net/blog/pages/lz-string]` |
| Geist via npm | Inter/Outfit via `next/font/google` | Brief was open between the two; user chose Geist (D-02). Geist npm ships self-hosted woff2 with zero next/font/google round-trip. `[CITED: vercel/geist-font]` |

### Installation (single-shot Plan 1 command)

```bash
# Bootstrap fresh Next.js 16 project (Plan 1 / Wave 0 first task)
pnpm create next-app@latest exercised \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd exercised

# shadcn/ui init — answer: TypeScript yes, default style, base color "slate",
# CSS variables yes, RSC yes, write to components/ui
pnpm dlx shadcn@latest init

# Core runtime
pnpm add zod motion geist lz-string lucide-react clsx tailwind-merge sonner next-themes

# Add shadcn primitives (one command per — keeps install minimal)
pnpm dlx shadcn@latest add button input card skeleton sonner tooltip

# Dev
pnpm add -D vitest @vitest/ui prettier prettier-plugin-tailwindcss
```

**Verification step (planner inserts as Task 0.X):**
- After `npm view` results, every package above lists a source repository on its npm page — required for `[VERIFIED: npm registry]` tagging.
- `geist@1.7.0` published 2026-02-06 per `npm view geist time --json` — current and maintained.
- `motion@12.38.0` published 2026-03-17 — current.
- `zod@4.4.3` (4.5.0-canary is in flight as of 2026-05-04 but 4.4.3 is stable latest).
- `tailwindcss@4.3.0` published with `latest` dist-tag.

## Package Legitimacy Audit

Slopcheck was run on the recommended packages with `slopcheck install <pkgs>`. **Slopcheck defaults to PyPI** and incorrectly flagged Node packages (`lz-string`, `lucide-react`, `sonner`, `next-themes`, `@ai-sdk/openai`, `ai`, `@upstash/redis`, `@upstash/ratelimit`) as `[SLOP]` — these are real, widely-used npm packages, not Python packages. Each was re-verified against the **npm registry** (the correct ecosystem) via `npm view <pkg> version repository.url`.

| Package | Registry | Current Ver | Source Repo | slopcheck (PyPI) | npm verification | Disposition |
|---------|----------|-------------|-------------|-------------------|------------------|-------------|
| `next` | npm | 16.2.6 | github.com/vercel/next.js | [OK] cross-eco | Verified, official Vercel repo | Approved |
| `tailwindcss` | npm | 4.3.0 | github.com/tailwindlabs/tailwindcss | [OK] cross-eco | Verified, official Tailwind Labs | Approved |
| `motion` | npm | 12.38.0 | github.com/motiondivision/motion | [OK] cross-eco | Verified, motiondivision/motion (formerly framer/motion) | Approved |
| `zod` | npm | 4.4.3 | github.com/colinhacks/zod | [OK] cross-eco | Verified, colinhacks repo | Approved |
| `lz-string` | npm | 1.5.0 | github.com/pieroxy/lz-string | [SLOP] (false — PyPI lookup) | Verified, pieroxy/lz-string since 2013 (v1.5.0 published 2023-03-04) | Approved |
| `geist` | npm | 1.7.0 | github.com/vercel/geist-font | [SUS] (false — 85 PyPI downloads for unrelated pkg) | Verified, official Vercel font package | Approved |
| `lucide-react` | npm | 1.16.0 | github.com/lucide-icons/lucide | [SLOP] (false — PyPI lookup) | Verified, lucide-icons/lucide | Approved |
| `sonner` | npm | 2.0.7 | github.com/emilkowalski/sonner | [SLOP] (false — PyPI lookup) | Verified, emilkowalski/sonner (toast library used by shadcn/ui) | Approved |
| `clsx` | npm | 2.1.1 | github.com/lukeed/clsx | [OK] cross-eco | Verified, lukeed/clsx | Approved |
| `tailwind-merge` | npm | 3.6.0 | github.com/dcastil/tailwind-merge | [OK] cross-eco | Verified, dcastil/tailwind-merge | Approved |
| `next-themes` | npm | 0.4.6 | github.com/pacocoursey/next-themes | [SLOP] (false — PyPI lookup) | Verified, pacocoursey/next-themes | Approved |
| `@radix-ui/react-tooltip` | npm | 1.2.8 | github.com/radix-ui/primitives | not scanned | Verified, official Radix UI | Approved |
| `vitest` | npm | (latest) | github.com/vitest-dev/vitest | not scanned | Verified, official | Approved |
| `prettier` | npm | (latest) | github.com/prettier/prettier | not scanned | Verified, official | Approved |
| `prettier-plugin-tailwindcss` | npm | (latest) | github.com/tailwindlabs/prettier-plugin-tailwindcss | not scanned | Verified, official Tailwind Labs | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** None — all `[SLOP]` results were ecosystem-confusion false positives. Slopcheck checked PyPI; these are npm packages.

**Packages flagged as suspicious `[SUS]`:** None for real (the `geist` `[SUS]` was for an unrelated low-popularity PyPI package with the same name).

**Note on Phase 1 scope:** `@ai-sdk/openai`, `ai`, `@upstash/redis`, `@upstash/ratelimit` are NOT installed in Phase 1 (they're Phase 2 dependencies for the real pipeline). Listed in STACK.md for forward reference only.

**Postinstall script check (Node-specific):**
```bash
npm view next scripts.postinstall          # → undefined (no postinstall)
npm view motion scripts.postinstall        # → undefined
npm view zod scripts.postinstall           # → undefined
npm view lz-string scripts.postinstall     # → undefined
npm view geist scripts.postinstall         # → undefined
npm view sonner scripts.postinstall        # → undefined
```
No suspicious postinstall scripts. Each command must be re-run as a verification step before install — planner adds this to Wave 0 (foundations) as a confirmation gate.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                             │
│                                                                       │
│  RSC: app/page.tsx                                                    │
│    ├── <Hero />                  ← static markup, server-rendered     │
│    ├── <AmbientBackground />     ← fixed-position orb div             │
│    ├── <ExtractFlow />           ← ONLY client island                 │
│    │     │                                                            │
│    │     ├── useReducer(reducer, initialState)                        │
│    │     ├── on mount: check ?w= → decode → dispatch(success)         │
│    │     │                                                            │
│    │     │  State: idle                                               │
│    │     │     ▼                                                      │
│    │     │  <UrlInput onSubmit={url => dispatch(submit, url)} />     │
│    │     │     ▼ POST /api/extract { url }                            │
│    │     │  State: submitting                                         │
│    │     │     ▼ SSE events arrive                                    │
│    │     │  State: streaming (cycles through stages)                  │
│    │     │  <LoadingStages currentStage={…} />                        │
│    │     │     ▼ result event                                         │
│    │     │  State: success                                            │
│    │     │  <WorkoutView workout={…} shouldAnimateIn={true} />        │
│    │     │     │                                                      │
│    │     │     ├── <WorkoutHeader />                                  │
│    │     │     ├── <ExerciseCard /> × N (cascade-staggered)           │
│    │     │     ├── <SupersetCard /> × M (cascade-staggered)           │
│    │     │     └── <ActionBar /> (Copy MD / Copy Plain / Share)       │
│    │     │           │                                                │
│    │     │           ├── Copy → navigator.clipboard.writeText         │
│    │     │           └── Share → lz-string.compress → ?w= → toast     │
│    │     │                                                            │
│    │     ▼ error event                                                │
│    │  State: error                                                    │
│    │  <ErrorState code={NETWORK|NO_WORKOUT|RATE_LIMITED} />          │
│    └── <Footer />                ← static AI-disclaimer + credit      │
└────────────────────────────────────┬─────────────────────────────────┘
                                     │
                                     │ POST /api/extract { url }
                                     │ (response: text/event-stream)
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│              VERCEL — Next.js 16 App Router (Fluid Compute)           │
│                                                                       │
│  app/api/extract/route.ts                                             │
│    ├── export const maxDuration = 300                                 │
│    ├── export const dynamic = "force-dynamic"                         │
│    ├── export const runtime = "nodejs"                                │
│    ├── POST(req):                                                     │
│    │     │  Parse { url } with ExtractRequestSchema (Zod)             │
│    │     │  Pick service via getExtractionService() ← reads env       │
│    │     │  Return new Response(ReadableStream(...) , SSE headers)    │
│    │     │     headers:                                               │
│    │     │       Content-Type: text/event-stream                      │
│    │     │       Cache-Control: no-cache, no-transform                │
│    │     │       Connection: keep-alive                               │
│    │     │       X-Accel-Buffering: no  ← critical for Vercel         │
│    │     ▼                                                            │
│    │  iteratorToStream( service.extract(url) )                        │
│    │     │ for-await each ExtractEvent:                               │
│    │     │   encode `data: ${JSON.stringify(event)}\n\n` → enqueue    │
│    │     ▼                                                            │
│    │  controller.close() on AsyncIterable completion                  │
│    └──                                                                │
│                                                                       │
│  lib/extraction/service.ts  ← factory                                 │
│    ├── EXTRACT_MODE=mock  → MockExtractionService                     │
│    └── EXTRACT_MODE=real  → RealExtractionService (Phase 2)           │
│                                                                       │
│  lib/extraction/mock.ts                                               │
│    ├── load fixtures at module init (WorkoutSchema.parse)             │
│    ├── async *extract(url):                                           │
│    │     │  if (url contains 'fail') yield error NETWORK; return      │
│    │     │  if (url contains 'empty') yield error NO_WORKOUT; return  │
│    │     │  if (url contains 'rate-limit') yield error RATE_LIMITED;  │
│    │     │  videoId = parse(url) or hash(url)                         │
│    │     │  fixture = fixtures[hash(videoId) mod fixtures.length]     │
│    │     │  yield {stage: fetching};      sleep 1200ms                │
│    │     │  yield {stage: transcribing};  sleep 1100ms                │
│    │     │  yield {stage: analyzing};     sleep 1100ms                │
│    │     │  yield {stage: generating};    sleep 1000ms                │
│    │     │  yield {result: fixture}                                   │
│    └──                                                                │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
exercised/
├── app/
│   ├── layout.tsx                       # Fonts (Geist), <html class="dark">, sonner Toaster
│   ├── page.tsx                         # RSC — Hero, AmbientBackground, ExtractFlow, Footer
│   ├── globals.css                      # @import "tailwindcss"; @theme block (all tokens)
│   └── api/
│       └── extract/
│           └── route.ts                 # POST handler — Zod-validated, SSE stream, maxDuration=300
├── components/
│   ├── extract/
│   │   ├── ExtractFlow.tsx              # "use client" — owns useReducer + SSE consumer + share-hydrate
│   │   ├── UrlInput.tsx                 # Glass-styled input + CTA, inline validation
│   │   ├── LoadingStages.tsx            # 4-row stage list with pulse-dot/checkmark + 4 skeletons
│   │   ├── ErrorState.tsx               # Heading + body + recovery button per ERRS-02/03
│   │   └── reducer.ts                   # Pure state machine: idle | submitting | streaming | success | error
│   ├── workout/
│   │   ├── WorkoutView.tsx              # Container — header + cards + action bar + footer
│   │   ├── WorkoutHeader.tsx            # Title, creator, duration chip, difficulty chip, muscle pills
│   │   ├── MusclePill.tsx
│   │   ├── DifficultyChip.tsx           # accent-rules-aware (UI-SPEC §4.1)
│   │   ├── DurationChip.tsx
│   │   ├── ExerciseCard.tsx             # Form-cue expand toggle
│   │   ├── SupersetCard.tsx             # Bracketed group + shared rest indicator
│   │   ├── SkeletonCard.tsx             # 3-bar shimmer (reused in loading + future cache UX)
│   │   └── ActionBar.tsx                # Watch / Copy-MD / Copy-Plain / Share
│   ├── layout/
│   │   ├── AmbientBackground.tsx        # fixed-position 3-orb container
│   │   └── Footer.tsx                   # AI-disclaimer + credit
│   └── ui/                              # shadcn primitives (button, input, card, skeleton, sonner, tooltip)
├── lib/
│   ├── schema/
│   │   └── workout.ts                   # Zod: WorkoutSchema, ExtractRequestSchema, ExtractEventSchema, types
│   ├── extraction/
│   │   ├── service.ts                   # ExtractionService interface + getExtractionService() factory
│   │   ├── mock.ts                      # MockExtractionService — fixtures, URL-keyword errors, hash-mod-N
│   │   └── (real.ts — Phase 2 only)
│   ├── sse/
│   │   └── stream.ts                    # iteratorToStream(AsyncIterable<T>) helper + SSE encoder
│   ├── youtube/
│   │   └── url.ts                       # parseYouTubeUrl(s): { videoId, isValid }; trim tracking params
│   ├── share/
│   │   ├── encode.ts                    # Workout → lz-string → ?w= (with strip chain per D-17)
│   │   └── decode.ts                    # ?w= → lz-string → WorkoutSchema.parse (with schema_version check per D-18)
│   ├── clipboard/
│   │   ├── markdown.ts                  # workoutToMarkdown(w): string
│   │   └── plaintext.ts                 # workoutToPlainText(w): string
│   └── utils.ts                         # cn() = clsx + tailwind-merge
├── tests/
│   └── fixtures/
│       ├── dumbbell-leg-day.json
│       ├── bodyweight-push.json
│       ├── full-body-2-supersets.json
│       ├── warmup-3-exercises.json
│       └── hypertrophy-12-exercises.json
├── public/                              # static assets (none for Phase 1 — Geist embeds via npm pkg)
├── .env.local                           # EXTRACT_MODE=mock (or unset; default in factory is mock)
├── .env.example                         # documents EXTRACT_MODE
├── components.json                      # shadcn config (generated by init)
├── vercel.json                          # minimal — see Deployment section below
├── package.json
└── tsconfig.json
```

**Why this structure:**
- **`app/` is thin.** Only the route handler and page shells. All logic in `lib/` stays testable without Next.js.
- **`lib/extraction/` is the swap point.** Phase 2 adds `real.ts`; the factory updates trivially.
- **`lib/schema/workout.ts` is single source of truth.** Imported by fixtures (boot validation), mock service, future LLM call (Phase 2), and frontend type imports.
- **`tests/fixtures/*.json` are real files, not inline objects.** Per D-14: parsed by `WorkoutSchema.parse()` at module load — schema drift fails fast at the contract boundary.
- **`lib/share/`, `lib/clipboard/` are isolated.** Each is a tiny pure-function module — easy to unit-test with Vitest (Plan 1 includes round-trip share encode/decode test).

### Pattern 1: Server Component Shell + Single Client Island

**What:** Everything above `<ExtractFlow />` is RSC. `<ExtractFlow />` is the only `"use client"` boundary.

**When to use:** Form-driven SPAs with a single primary interaction. Exactly this app.

**Tradeoffs:**
- Server-rendered HTML for the landing → fast first paint, SEO-friendly
- Small client bundle — only the interactive parts ship JS
- `<WorkoutView />` and children are also `"use client"` because they animate; that's accepted

**Example:**
```tsx
// app/page.tsx — Server Component (no "use client")
import { ExtractFlow } from "@/components/extract/ExtractFlow";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <AmbientBackground />
      <main className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <ExtractFlow />   {/* The only client island */}
      </main>
      <Footer />
    </>
  );
}
```

### Pattern 2: `useReducer` State Machine (no Zustand)

See Code Examples §State Machine below. Five states (`idle | submitting | streaming | success | error`), ~6 actions (`submit | stage | success | error | reset | hydrate`).

### Pattern 3: Service Interface for Mock/Real Swap

```ts
// lib/extraction/service.ts
import type { ExtractEvent } from "@/lib/schema/workout";

export interface ExtractionService {
  extract(url: string): AsyncIterable<ExtractEvent>;
}

export async function getExtractionService(): Promise<ExtractionService> {
  const mode = process.env.EXTRACT_MODE ?? "mock";
  if (mode === "real") {
    const { RealExtractionService } = await import("./real");
    return RealExtractionService;
  }
  const { MockExtractionService } = await import("./mock");
  return MockExtractionService;
}
```

The dynamic `import()` keeps real-pipeline deps out of the mock build. In Phase 1, `./real` doesn't exist yet — that branch is unreachable, and the build doesn't try to resolve it because the import is dynamic + gated by env at runtime.

### Pattern 4: SSE via `ReadableStream` + AsyncIterable bridge

See Code Examples §SSE Route below. Pattern is verified against Next.js 16 documentation and the Vercel Fluid Compute streaming model.

### Pattern 5: Zod Schema as Single Source of Truth

See Code Examples §Zod Schema below.

### Pattern 6: Tailwind 4 `@theme` Block for Design Tokens

All design tokens live in `app/globals.css` inside a single `@theme` block. **No `tailwind.config.ts`** — Tailwind 4 is CSS-first. shadcn/ui's CSS variables coexist via `@theme inline { --color-primary: var(--primary); }` bridge.

### Anti-Patterns to Avoid

- **"Just make `app/page.tsx` a Client Component."** Defeats App Router's main benefit. Push `"use client"` down to `<ExtractFlow />`. `[CITED: ARCHITECTURE.md Anti-Pattern 1]`
- **Two routes (`/api/extract-mock` vs `/api/extract`).** Frontend knows the mode; every env reconfigured at two layers. Use service factory inside ONE route. `[CITED: ARCHITECTURE.md Anti-Pattern 2]`
- **`setTimeout`-driven stage cycle in the UI.** PITFALLS.md §7 — fake loading reads as theatrical. Mock service emits real timed events; UI is dumb about timing. `[CITED: PITFALLS.md §7]`
- **Hand-written TS interface for Workout + separate Zod schema.** They drift. Use `type Workout = z.infer<typeof WorkoutSchema>`. `[CITED: ARCHITECTURE.md Anti-Pattern 4]`
- **Glassmorphism on flat `#000` background.** Cards disappear; reads as 2014 Dribbble. Use `#08090C` base + 3 gradient orbs (UI-SPEC §5.1). `[CITED: PITFALLS.md §6]`
- **`backdrop-filter` without `-webkit-` prefix.** Safari < 17 needs `-webkit-backdrop-filter`. UI-SPEC §5.2 already ships both. `[CITED: caniuse + tutorialpedia]`
- **Long lz-string payloads without strip-chain fallback.** 12-exercise fixtures will exceed 2KB. D-17 strip chain is non-optional. `[CITED: CONTEXT.md D-17]`
- **`async for await` of the iterable before returning Response.** Buffers the whole stream server-side. Return Response immediately; let the ReadableStream pull from the iterable lazily. `[CITED: Medium SSE Vercel fix + Upstash blog]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-safe compression for share state | base64 + manual escape of `+/=` | `lz-string` `compressToEncodedURIComponent` | URL-safety + compression in one call; widely battle-tested |
| Stage-cycle animation orchestration | CSS keyframe + JS class swaps | Motion 12 `AnimatePresence` + variants | Cross-fade + stagger in 5 lines vs ~40 of CSS |
| Toast notification system | Custom div + portal + timer | `sonner` (shadcn-blessed) | Accessibility (`aria-live`), stacking, dismiss, animation built-in |
| Schema validation at runtime | `if (typeof x === 'string')` checks | Zod | Same schema constrains LLM in Phase 2 (`generateObject(WorkoutSchema)`) — single source of truth |
| Font loading + CLS prevention | `<link rel="preload">` + manual woff2 | `geist` npm package | Self-hosted woff2 with `font-display: swap` baked in; zero CLS verified by Vercel |
| Reduced-motion gating | `window.matchMedia + addEventListener` boilerplate | Motion's `useReducedMotion()` hook | Auto-rerenders on OS toggle; no manual subscription |
| Class name composition with Tailwind | Template-literal concatenation | `cn()` = `clsx + tailwind-merge` | Resolves conflicting Tailwind classes (e.g., `px-4` overriding earlier `px-2`) — without this, glass + variant classes silently fight |
| SSE event encoding | `controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify(x) + "\n\n"))` everywhere | A 10-line helper in `lib/sse/stream.ts` | DRY; one place to fix when SSE comment-heartbeat is added in Phase 2 |
| YouTube URL validation | Hand-rolled regex per component | `lib/youtube/url.ts` with `parseYouTubeUrl(s)` returning `{ videoId, isValid }` | Same parser used in mock for `hash(videoId)` and in input validation — must agree |
| Markdown / plain-text serialization of workout | Inline render functions in components | `lib/clipboard/{markdown,plaintext}.ts` pure functions | Vitest-testable; no DOM dependency |
| Tooltip primitives | Custom positioning + portal | shadcn `tooltip` (Radix-based) | Accessibility + portal + collision detection for free |

**Key insight:** Phase 1 is greenfield, but **every problem above already has a chosen, vetted solution in this stack.** The trap is "I'll just inline it for now" — that "now" becomes the convention Phase 2 inherits. Plans should explicitly choose the library, not hand-roll.

## Runtime State Inventory

**N/A — greenfield phase.** No existing runtime state, no databases, no OS-registered services, no installed artifacts. Phase 1 *creates* the first artifacts that future phases will need to track: fixture JSON files, fonts (self-hosted via npm), the Zod schema as a versioned wire contract. There is no pre-existing state to migrate.

The closest analogue is the `schema_version: "1"` literal in `WorkoutSchema` — this is **forward-state** the share-link mechanism depends on. Plan 1 must lock this value; Phase 2 has no reason to bump it (same schema, new producer); a real version bump in Phase 4 would invalidate older share links and surface the D-18 error path.

## Common Pitfalls

### Pitfall 1: SSE buffered on Vercel — UI sees all stages at once

**What goes wrong:** You implement the route handler as `async function POST() { const events = await collectAllEvents(); return new Response(events); }`. Locally it kind of works (slow first paint). Deployed to Vercel, the entire stream is buffered and arrives as one chunk — stages don't visibly transition; user sees idle → success in one frame.

**Why it happens:** Next.js's router waits for the handler function to complete before sending the Response if you `await` the async iterator before returning. Vercel's edge layer additionally buffers if `Cache-Control: no-transform` is missing or `X-Accel-Buffering: no` is missing. `[CITED: medium.com fixing-slow-sse-server-sent-events]`

**How to avoid:**
- Return the Response **immediately**, passing the `ReadableStream` to it. The stream pulls from the AsyncIterable lazily as the client reads.
- Set all four critical headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- `export const dynamic = "force-dynamic"` — without it, Next.js may statically optimize the route and break streaming entirely. `[CITED: nextjslaunchpad SSE guide 2026]`

**Warning signs:**
- Local dev works, deployed-to-Vercel preview shows all-at-once render.
- Network tab shows the response chunk count = 1 (instead of N events).
- Each `data: {…}\n\n` event arrives but only after the function "completes" server-side.

### Pitfall 2: Hydration mismatch on share link (`?w=` decode)

**What goes wrong:** `<ExtractFlow />` mounts → reads `window.location.search?.w` → decompresses → dispatches `hydrate(workout)` → reducer jumps to `success`. But the very first render returned `idle` (server didn't have `window`), and now the second render shows `success`. React logs a hydration mismatch.

**Why it happens:** The `?w=` param is only visible to the client. On the server-render pass, the param isn't accessible (RSC doesn't see `window.location`; the URL is on the request but Next 16 RSC doesn't directly expose `searchParams` to nested client components without prop drilling).

**How to avoid:**
- Make `<ExtractFlow />` always render `<UrlInput />` initially (matching server output).
- Decode the `?w=` param in a `useEffect` after mount; only then dispatch the `hydrate` action.
- Briefly show the input — single render frame — before the success view replaces it. Acceptable UX; the alternative (passing `searchParams` as a prop from the server-side `page.tsx`) couples RSC to client state and complicates the SSR path.
- Alternative (premium polish): server-read `searchParams` in `page.tsx`, pass `initialState` to `<ExtractFlow />`. Costs an SSR roundtrip computing the decode but eliminates the input-flash. **Recommendation: ship the simpler effect-based approach in Phase 1; consider SSR pre-decode as a Phase 4 polish.**

**Warning signs:**
- Console: "Hydration failed because the initial UI does not match what was rendered on the server."
- Brief flash of the URL input before the workout view appears on a share-link load.

### Pitfall 3: Fixture parse failure crashes app at boot

**What goes wrong:** A typo in `tests/fixtures/dumbbell-leg-day.json` (e.g., `"type": "standard"` instead of `"type": "standard_set"`) — `WorkoutSchema.parse()` throws at module load → process exits → 500 on every request.

**Why it happens:** Per D-14, fixtures are validated at module load (top-level `parse()` call in `lib/extraction/mock.ts`). This is the **correct** behavior — fail fast on schema drift. But it means a typo blocks ALL traffic, not just the mock route.

**How to avoid:**
- Add a Vitest test (`tests/schema.test.ts`) that imports every fixture and `parse`s it. Make this test run in CI so fixture drift breaks the build, not production.
- Wrap the boot parse in a try/catch that logs a clear error and re-throws — at least the failure mode is visible in logs.
- During development, run `pnpm test` on every fixture edit (or use Vitest's watch mode).

**Warning signs:**
- 500 on every page load after a fixture edit, no helpful message in dev console.
- `ZodError` with a deep path like `routine.2.exercises.0.sets` in the server log.

### Pitfall 4: lz-string payload exceeds URL length on the 12-exercise fixture

**What goes wrong:** Share button on the 12-exercise hypertrophy fixture produces a `?w=…` URL that exceeds the practical URL length limit (~2KB user-friendly, browsers technically support more but proxies/CDNs truncate at ~8KB).

**Why it happens:** 12 exercises × (`sourceQuote` + `form_cues[3]` + `equipment[]` + metadata) ≈ 6–10KB raw JSON. lz-string compresses ~40–70%, but the worst case still nudges 2–3KB. D-17 strip chain is the mitigation, but the chain must actually be implemented and the threshold tested.

**How to avoid:**
- Plan 1 has a measurement task: for each of the 5 fixtures, log the compressed payload size and choose strip points if any exceeds 2KB.
- Implement the strip chain in `lib/share/encode.ts` per D-17 order: `sourceQuote` first, `form_cues` second, `equipment[]` third — keep header + sets/reps/rest + supersets.
- Surface the strip event to the recipient: append `&stripped=1` (or a strip-flag-set in the payload) → UI shows the notice "Share link omits form cues for length."

**Warning signs:**
- URL Bar shows a multi-thousand-character `?w=…` for a normal-sized workout.
- Shared link arrives broken (truncated by Slack/Discord/Twitter URL handlers).

### Pitfall 5: Glassmorphism cards invisible against the gradient orbs

**What goes wrong:** Cards at 5% opacity float over a gradient — designer reviews on desktop and the cards are barely visible. Increase opacity to 25% to fix → cards now look like opaque slabs and lose the "glass" reading.

**Why it happens:** The 10–12% opacity range is narrow (CONTEXT.md D-03). UI-SPEC §4 settled on **11%** (`rgba(255,255,255,0.11)`) plus `saturate(140%)` to boost the chroma of whatever's behind. Without the saturate boost, the orbs wash out at 11%.

**How to avoid:**
- Use UI-SPEC §5.2 recipe verbatim — `backdrop-filter: blur(16px) saturate(140%)` (note the `saturate`).
- WCAG contrast verified pre-build per UI-SPEC §4.2 (14.2:1 for body text).
- Add an `axe-core` task in Plan 1 (`pnpm dlx @axe-core/cli http://localhost:3000`) before deployment.

**Warning signs:**
- Designer says "looks washed out" or "I can't tell where the card ends."
- `axe-core` flags color-contrast failures.

### Pitfall 6: Cleanup on aborted SSE — leaked async iterator

**What goes wrong:** User clicks "Extract Workout", waits 2s, navigates away. The ReadableStream stays open (client disconnect not propagated) → mock service keeps `sleep`ing → eventually `controller.enqueue` throws because the controller is closed.

**Why it happens:** AbortController on the fetch isn't wired to the server-side iterator. The route handler doesn't know the client disconnected until `controller.enqueue` fails.

**How to avoid:**
- In `iteratorToStream`, catch errors from `controller.enqueue` and `return` early from the pull function — this also signals the iterator to short-circuit.
- Pattern: in the AsyncIterable's `try { ... } finally { /* cleanup */ }`, ensure any timers (`sleep`) use AbortSignal-aware delays so they cancel cleanly. In Phase 1, this is academic (mock has no resources to leak); the pattern matters for Phase 2 when there's an open `fetch` to OpenAI.
- In `<ExtractFlow />`, wire `AbortController.signal` into the `fetch` and abort on unmount.

**Warning signs:**
- Server logs `controller is closed` errors after user-initiated navigations.
- Vercel function durations longer than expected (function instances running past client disconnect).

### Pitfall 7: Reduced-motion implementation gap

**What goes wrong:** `useReducedMotion()` gates the result cascade and pulse-dot, but the gradient orb CSS animations and skeleton shimmer use raw `@keyframes` — they ignore the hook.

**Why it happens:** Motion's hook only governs Motion components. CSS animations need `@media (prefers-reduced-motion: reduce) { .orb { animation: none; } }` rules, set at the CSS layer.

**How to avoid:**
- UI-SPEC §6.5 enumerates all 7 motion moments. Plan 1 needs a task per moment to verify reduced-motion behavior.
- Single CSS block in `globals.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .orb-1, .orb-2, .orb-3 { animation: none !important; }
    .skeleton-shimmer { animation: none !important; }
    .pulse-dot { animation: none !important; }
    .card-hover-lift { transition: none !important; transform: none !important; }
  }
  ```
- Use Motion's `useReducedMotion()` for the JS-driven moments (cascade, stage AnimatePresence).
- Test: macOS System Settings → Accessibility → Display → Reduce Motion (toggle) → reload page → verify all 7 moments comply.

**Warning signs:**
- Reduce-motion enabled but orbs still drift (only Motion gates work).
- Reduce-motion enabled but result cascade still staggers (Motion's `useReducedMotion()` wasn't read).

### Pitfall 8: Tailwind 4 vs shadcn CSS-variable bridge missing

**What goes wrong:** shadcn primitives reference `--primary`, `--accent`, etc. The init script wrote those to `:root` and `.dark`. But Tailwind utilities like `bg-primary` don't exist because Tailwind 4 needs `@theme inline { --color-primary: var(--primary); }` to know about them. Result: shadcn buttons render with no background color.

**Why it happens:** Tailwind 4's `@theme` namespace-drives-utilities behavior is different from v3's config-driven model. The shadcn init produces a v3-style or hybrid CSS — the planner must verify the bridge.

**How to avoid:**
- Before installing custom components, manually add to `globals.css`:
  ```css
  @import "tailwindcss";

  @theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-ring: var(--ring);
    /* … all other shadcn tokens … */
  }

  :root { /* shadcn writes here */ }
  .dark { /* shadcn writes here */ }
  ```
- Verify by running the dev server, adding `<Button>Test</Button>`, and inspecting that `bg-primary` resolves to a non-empty value.

**Warning signs:**
- shadcn primitives look unstyled (no fill on Button, no border on Card).
- DevTools shows `--color-primary` undefined but `--primary` defined.

### Pitfall 9: `EXTRACT_MODE` accidentally set to "real" in production

**What goes wrong:** Phase 2 someone sets `EXTRACT_MODE=real` in the Vercel project env vars. Phase 1 ships before that. The factory tries to import `./real` — module not found — 500.

**Why it happens:** Dynamic imports fail at runtime, not build time. Phase 1's `./real.ts` doesn't exist yet.

**How to avoid:**
- Plan 1: explicitly set `EXTRACT_MODE=mock` in `.env.example` and in the Vercel preview/production env vars.
- Factory checks `process.env.EXTRACT_MODE === "real"`; default falls through to mock (per ARCHITECTURE.md). Phase 1 never hits the `real` branch.
- Optional: create a stub `lib/extraction/real.ts` that throws `new Error("Real extraction not implemented — set EXTRACT_MODE=mock or implement Phase 2")` so the failure mode is clear.

**Warning signs:**
- 500 on `/api/extract` in production despite passing local tests.
- Error log: "Cannot find module './real'."

## Code Examples

Verified patterns from official sources. Planner can use these as direct templates.

### Zod Schema (lib/schema/workout.ts)

```ts
// Source: zod.dev/api (verified for Zod 4.4.3)
// Source: ARCHITECTURE.md Pattern 5
import { z } from "zod";

// ─── Per-exercise common fields (locked schema for Phase 4 forward-compat) ───
const ExerciseCoreSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.string().min(1),                      // "10" | "8-12" | "AMRAP"
  rest_seconds: z.number().int().nonnegative(),
  form_cues: z.array(z.string()).default([]),
  startTimestamp: z.number().int().nonnegative().nullable(),  // SCHM-03 — Phase 4 renders
  sourceQuote: z.string().nullable(),                          // SCHM-03 — Phase 4 renders
  equipment: z.array(z.string()).default([]),                  // SCHM-03 — Phase 4 renders
});

// ─── Routine entry types — discriminated union on `type` (SCHM-05) ───
const StandardSetSchema = ExerciseCoreSchema.extend({
  type: z.literal("standard_set"),
});

const SupersetSchema = z.object({
  type: z.literal("superset"),
  exercises: z.array(ExerciseCoreSchema).min(2),
  rest_seconds: z.number().int().nonnegative(),
});

export const RoutineItemSchema = z.discriminatedUnion("type", [
  StandardSetSchema,
  SupersetSchema,
]);

// ─── Workout — top-level (SCHM-02) ───
export const WorkoutSchema = z.object({
  schema_version: z.literal("1"),                      // SCHM-02 — D-18 versioning
  workout_title: z.string().min(1),
  creator_username: z.string().min(1),
  target_muscles: z.array(z.string()).default([]),
  estimated_duration_mins: z.number().int().positive(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),  // SCHM-04
  extraction_confidence: z.enum(["high", "medium", "low"]),       // SCHM-02
  routine: z.array(RoutineItemSchema).min(1),
});

// ─── Wire contract for /api/extract ───
export const ExtractRequestSchema = z.object({
  url: z.string().url(),
});

export const ExtractEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stage"),
    stage: z.enum(["fetching", "transcribing", "analyzing", "generating"]),
  }),
  z.object({ type: z.literal("result"), workout: WorkoutSchema }),
  z.object({
    type: z.literal("error"),
    code: z.enum(["NETWORK", "NO_WORKOUT", "RATE_LIMITED", "UNKNOWN"]),
    message: z.string(),
  }),
]);

// ─── Inferred TypeScript types ───
export type Workout = z.infer<typeof WorkoutSchema>;
export type RoutineItem = z.infer<typeof RoutineItemSchema>;
export type ExtractEvent = z.infer<typeof ExtractEventSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
```

### SSE Route Handler (app/api/extract/route.ts)

```ts
// Source: nextjs.org/docs/app/api-reference/file-conventions/route (Streaming section)
// Source: upstash.com/blog/sse-streaming-llm-responses
// Source: ARCHITECTURE.md Pattern 4
import { ExtractRequestSchema } from "@/lib/schema/workout";
import { getExtractionService } from "@/lib/extraction/service";
import { toSSEStream } from "@/lib/sse/stream";

export const runtime = "nodejs";              // Fluid Compute (default for Node since 2025-04)
export const dynamic = "force-dynamic";        // PIPE-01: required to prevent static optimization
export const maxDuration = 300;                // OPS-03: 5 minutes (Hobby max with Fluid Compute)

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = await getExtractionService();
  const iterator = service.extract(parsed.data.url);
  const stream = toSSEStream(iterator);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",   // Critical: prevents Vercel edge buffering
    },
  });
}
```

### SSE Stream Helper (lib/sse/stream.ts)

```ts
// Source: nextjs.org Streaming docs (iteratorToStream pattern from MDN)
// Source: upstash.com/blog/sse-streaming-llm-responses (SSE data-line format)
const encoder = new TextEncoder();

export function toSSEStream<T>(iterator: AsyncIterable<T>): ReadableStream<Uint8Array> {
  const iter = iterator[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iter.next();
        if (done) {
          controller.close();
          return;
        }
        const line = `data: ${JSON.stringify(value)}\n\n`;
        controller.enqueue(encoder.encode(line));
      } catch (err) {
        const errEvent = {
          type: "error" as const,
          code: "UNKNOWN" as const,
          message: err instanceof Error ? err.message : "Stream error",
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
        controller.close();
      }
    },
  });
}
```

### Mock Extraction Service (lib/extraction/mock.ts)

```ts
// Source: ARCHITECTURE.md Pattern 3 + CONTEXT.md D-07, D-10, D-12, D-13, D-14
import type { ExtractEvent, Workout } from "@/lib/schema/workout";
import { WorkoutSchema } from "@/lib/schema/workout";
import { parseYouTubeUrl } from "@/lib/youtube/url";

import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";
import bodyweightPush from "@/tests/fixtures/bodyweight-push.json";
import fullBody2Supersets from "@/tests/fixtures/full-body-2-supersets.json";
import warmup3 from "@/tests/fixtures/warmup-3-exercises.json";
import hypertrophy12 from "@/tests/fixtures/hypertrophy-12-exercises.json";

// D-14: parse at module load — schema drift fails fast
const FIXTURES: Workout[] = [
  WorkoutSchema.parse(dumbbellLegDay),
  WorkoutSchema.parse(bodyweightPush),
  WorkoutSchema.parse(fullBody2Supersets),
  WorkoutSchema.parse(warmup3),
  WorkoutSchema.parse(hypertrophy12),
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Deterministic hash → fixture index (D-12)
function hashStringMod(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export const MockExtractionService = {
  async *extract(url: string): AsyncIterable<ExtractEvent> {
    // D-13 — keyword-triggered error states
    if (/fail/i.test(url)) {
      yield { type: "stage", stage: "fetching" };
      await sleep(500);
      yield {
        type: "error",
        code: "NETWORK",
        message: "We couldn't reach the extraction service.",
      };
      return;
    }
    if (/empty/i.test(url)) {
      yield { type: "stage", stage: "fetching" };
      await sleep(700);
      yield { type: "stage", stage: "transcribing" };
      await sleep(700);
      yield {
        type: "error",
        code: "NO_WORKOUT",
        message: "We couldn't find an exercise routine in this video.",
      };
      return;
    }
    if (/rate-limit/i.test(url)) {
      await sleep(300);
      yield {
        type: "error",
        code: "RATE_LIMITED",
        message: "You've extracted a lot of workouts recently.",
      };
      return;
    }

    // D-12 — deterministic fixture selection
    const { videoId } = parseYouTubeUrl(url);
    const seed = videoId ?? url;
    const fixture = FIXTURES[hashStringMod(seed, FIXTURES.length)];

    // D-07 — ~4–5s total, ~1.0–1.2s per stage
    yield { type: "stage", stage: "fetching" };
    await sleep(1100);
    yield { type: "stage", stage: "transcribing" };
    await sleep(1100);
    yield { type: "stage", stage: "analyzing" };
    await sleep(1100);
    yield { type: "stage", stage: "generating" };
    await sleep(1000);
    yield { type: "result", workout: fixture };
  },
};
```

### State Machine Reducer (components/extract/reducer.ts)

```ts
// Source: ARCHITECTURE.md Pattern 2
import type { Workout } from "@/lib/schema/workout";

export type Stage = "fetching" | "transcribing" | "analyzing" | "generating";
export type ErrorCode = "NETWORK" | "NO_WORKOUT" | "RATE_LIMITED" | "UNKNOWN";

export type State =
  | { kind: "idle" }
  | { kind: "submitting"; url: string }
  | {
      kind: "streaming";
      url: string;
      currentStage: Stage;
      completedStages: ReadonlyArray<Stage>;
    }
  | { kind: "success"; workout: Workout; fromShareLink: boolean }
  | { kind: "error"; code: ErrorCode; message: string };

export type Action =
  | { type: "submit"; url: string }
  | { type: "stage"; stage: Stage }
  | { type: "success"; workout: Workout }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "hydrate"; workout: Workout }          // D-16: from ?w= share param
  | { type: "reset" };

export const initialState: State = { kind: "idle" };

const STAGE_ORDER: ReadonlyArray<Stage> = [
  "fetching",
  "transcribing",
  "analyzing",
  "generating",
];

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "submit":
      return { kind: "submitting", url: action.url };

    case "stage": {
      if (state.kind !== "submitting" && state.kind !== "streaming") return state;
      const url = state.kind === "submitting" ? state.url : state.url;
      const idx = STAGE_ORDER.indexOf(action.stage);
      const completed = STAGE_ORDER.slice(0, idx);
      return {
        kind: "streaming",
        url,
        currentStage: action.stage,
        completedStages: completed,
      };
    }

    case "success":
      return { kind: "success", workout: action.workout, fromShareLink: false };

    case "hydrate":
      return { kind: "success", workout: action.workout, fromShareLink: true };

    case "error":
      return { kind: "error", code: action.code, message: action.message };

    case "reset":
      return initialState;
  }
}
```

### SSE Consumer (excerpt from ExtractFlow.tsx)

```tsx
"use client";
import { useEffect, useReducer, useRef } from "react";
import { ExtractEventSchema, WorkoutSchema } from "@/lib/schema/workout";
import { decodeShareUrl } from "@/lib/share/decode";
import { reducer, initialState } from "./reducer";

export function ExtractFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // D-16: share-link hydration on mount (avoid hydration mismatch by deferring)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("w");
    if (!param) return;
    try {
      const workout = decodeShareUrl(param);  // throws on schema-version mismatch
      dispatch({ type: "hydrate", workout });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid share link";
      dispatch({ type: "error", code: "UNKNOWN", message: msg });
    }
  }, []);

  async function handleSubmit(url: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({ type: "submit", url });

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        dispatch({
          type: "error",
          code: "NETWORK",
          message: `HTTP ${res.status}`,
        });
        return;
      }

      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        // Parse SSE chunks: lines like "data: {...}\n\n"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          let event;
          try {
            event = ExtractEventSchema.parse(JSON.parse(json));
          } catch {
            continue; // ignore malformed event
          }
          if (event.type === "stage") dispatch({ type: "stage", stage: event.stage });
          else if (event.type === "result") dispatch({ type: "success", workout: event.workout });
          else if (event.type === "error") dispatch({ type: "error", code: event.code, message: event.message });
        }
      }
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      dispatch({
        type: "error",
        code: "UNKNOWN",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // … render based on state.kind …
}
```

### Tailwind 4 `@theme` Block (app/globals.css)

```css
/* Source: tailwindcss.com/docs/theme (v4 CSS-first config) */
/* Source: ui.shadcn.com/docs/theming (CSS variable bridge) */
/* Source: UI-SPEC.md §4 + §5 */

@import "tailwindcss";

/* shadcn CSS variables (written by `shadcn init`, customized for our palette) */
:root {
  /* shadcn semantic tokens — dark default */
  --background: 8 9 12;        /* #08090C (HSL-friendly RGB tuple) */
  --foreground: 244 246 248;   /* #F4F6F8 */
  --primary: 124 255 107;      /* #7CFF6B — neon green accent */
  --primary-foreground: 8 9 12;
  --accent: 124 255 107;
  --accent-foreground: 8 9 12;
  --ring: 124 255 107;
  --border: 255 255 255;       /* used with opacity utility e.g. border-white/10 */
  --input: 255 255 255;
  /* … remaining shadcn tokens omitted for brevity … */
}

.dark {
  /* dark is hardcoded in <html class="dark"> — values identical to :root in v1 */
}

@theme inline {
  /* Tailwind utility-class bridge for shadcn vars (Pitfall 8 mitigation) */
  --color-background: rgb(var(--background));
  --color-foreground: rgb(var(--foreground));
  --color-primary: rgb(var(--primary));
  --color-primary-foreground: rgb(var(--primary-foreground));
  --color-accent: rgb(var(--accent));
  --color-accent-foreground: rgb(var(--accent-foreground));
  --color-ring: rgb(var(--ring));

  /* Phase 1 custom tokens (UI-SPEC.md §4) */
  --color-bg-base: #08090C;
  --color-surface-glass: rgb(255 255 255 / 0.11);
  --color-border-glass: rgb(255 255 255 / 0.10);
  --color-text-primary: #F4F6F8;
  --color-text-muted: #A8B0BC;
  --color-accent-glow: rgb(124 255 107 / 0.35);
  --color-accent-muted: rgb(124 255 107 / 0.12);
  --color-destructive: #FF6B6B;
  --color-destructive-muted: rgb(255 107 107 / 0.12);

  /* Typography (geist@1.x npm) */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* Custom utilities for glass radius */
  --radius-glass: 16px;
}

/* Glass-card recipe (UI-SPEC §5.2) — reusable utility */
@layer components {
  .glass-card {
    background-color: var(--color-surface-glass);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid var(--color-border-glass);
    border-radius: var(--radius-glass);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
}

/* Mobile glassmorphism fallback (UI-SPEC §5.2 + Pitfall 11 mitigation) */
@supports not (backdrop-filter: blur(1px)) {
  .glass-card {
    background-color: rgba(20, 22, 28, 0.85);
    backdrop-filter: none;
  }
}

/* Reduced-motion master block (UI-SPEC §6.5) */
@media (prefers-reduced-motion: reduce) {
  .orb-1, .orb-2, .orb-3 { animation: none !important; }
  .skeleton-shimmer { animation: none !important; }
  .pulse-dot { animation: none !important; }
  .card-hover-lift { transition: none !important; transform: none !important; }
}
```

### Layout with Geist Font (app/layout.tsx)

```tsx
// Source: npmjs.com/package/geist (verified 2026-05-17, v1.7.0)
// Source: vercel/geist-font GitHub README
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata = {
  title: "Exercised — Turn workout videos into structured routines",
  description:
    "Paste a YouTube workout URL. We extract the exercises, sets, reps, and form cues in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans antialiased">
        {children}
        <Toaster richColors theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
```

### Motion 12 Result Cascade (excerpt from WorkoutView.tsx)

```tsx
// Source: motion.dev/docs/react-animate-presence + motion.dev/docs/react-use-reduced-motion
"use client";
import { motion, useReducedMotion } from "motion/react";
import type { Workout } from "@/lib/schema/workout";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.065 }, // 65ms per UI-SPEC §6.2
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 240 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 240 },
  },
};

export function WorkoutView({ workout, shouldAnimateIn }: {
  workout: Workout;
  shouldAnimateIn: boolean;
}) {
  const reduceMotion = useReducedMotion();

  // D-05: under reduced motion, simultaneous cross-fade only (no stagger, no transform)
  // shouldAnimateIn=false for share-link hydration (instant render per UI-SPEC §11)
  const animate = (shouldAnimateIn && !reduceMotion) ? "visible" : false;
  const initial = (shouldAnimateIn && !reduceMotion) ? "hidden" : false;

  return (
    <motion.div initial={initial} animate={animate} variants={containerVariants}>
      <motion.div variants={headerVariants}>
        {/* <WorkoutHeader workout={workout} /> */}
      </motion.div>
      {workout.routine.map((item, i) => (
        <motion.div key={i} variants={cardVariants}>
          {item.type === "standard_set"
            ? null /* <ExerciseCard exercise={item} /> */
            : null /* <SupersetCard superset={item} /> */}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Share-URL Encode/Decode (lib/share/{encode,decode}.ts)

```ts
// Source: github.com/pieroxy/lz-string (verified for v1.5.0)
// Source: CONTEXT.md D-16, D-17, D-18
import LZString from "lz-string";
import { WorkoutSchema, type Workout } from "@/lib/schema/workout";

const MAX_PAYLOAD_BYTES = 2048; // D-17 strip threshold

export type StripField = "sourceQuote" | "form_cues" | "equipment";

export function encodeShareUrl(workout: Workout): {
  encoded: string;
  stripped: StripField[];
} {
  const strippedFields: StripField[] = [];
  let candidate = workout;

  // D-17 strip chain: sourceQuote → form_cues → equipment
  const STRIP_ORDER: StripField[] = ["sourceQuote", "form_cues", "equipment"];

  for (let attempt = 0; attempt <= STRIP_ORDER.length; attempt++) {
    const json = JSON.stringify(candidate);
    const compressed = LZString.compressToEncodedURIComponent(json);
    if (compressed.length <= MAX_PAYLOAD_BYTES || attempt === STRIP_ORDER.length) {
      return { encoded: compressed, stripped: strippedFields };
    }
    const field = STRIP_ORDER[attempt];
    strippedFields.push(field);
    candidate = stripField(candidate, field);
  }
  // unreachable — loop always returns
  throw new Error("encodeShareUrl: strip loop exhausted");
}

function stripField(w: Workout, field: StripField): Workout {
  return {
    ...w,
    routine: w.routine.map((item) => {
      if (item.type === "standard_set") {
        if (field === "sourceQuote") return { ...item, sourceQuote: null };
        if (field === "form_cues") return { ...item, form_cues: [] };
        if (field === "equipment") return { ...item, equipment: [] };
      } else {
        return {
          ...item,
          exercises: item.exercises.map((ex) =>
            field === "sourceQuote"
              ? { ...ex, sourceQuote: null }
              : field === "form_cues"
              ? { ...ex, form_cues: [] }
              : { ...ex, equipment: [] },
          ),
        };
      }
      return item;
    }),
  };
}

// ─── decode ───
export function decodeShareUrl(encoded: string): Workout {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error("Invalid share link");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid share link payload");
  }
  // D-18 — schema-version check (throws ZodError if version mismatched)
  const result = WorkoutSchema.safeParse(parsed);
  if (!result.success) {
    const versionIssue = result.error.issues.find((i) =>
      i.path[0] === "schema_version",
    );
    if (versionIssue) {
      throw new Error(
        "This share link was created with a newer version of Exercised — try pasting the original YouTube URL instead.",
      );
    }
    throw new Error("Share link payload failed validation");
  }
  return result.data;
}
```

### YouTube URL Parser (lib/youtube/url.ts)

```ts
// Source: synthesized from INPT-02 + INPT-03 + CONTEXT.md D-13
const YT_PATTERN =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const TRACKING_PARAMS = ["si", "feature", "t", "list", "index", "pp", "utm_source", "utm_medium"];

export function parseYouTubeUrl(input: string): {
  videoId: string | null;
  isValid: boolean;
  cleaned: string;
} {
  const trimmed = input.trim();

  // INPT-03: auto-trim tracking params
  let cleaned = trimmed;
  try {
    const u = new URL(trimmed);
    for (const param of TRACKING_PARAMS) u.searchParams.delete(param);
    cleaned = u.toString();
  } catch {
    // not a URL — keep as-is, validation below will fail
  }

  const m = trimmed.match(YT_PATTERN);
  if (!m) return { videoId: null, isValid: false, cleaned };
  return { videoId: m[1], isValid: true, cleaned };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.ts` with `theme: { extend: {...} }` | Tailwind 4 `@theme` block in CSS | Tailwind 4 released 2024-12 | Config moves to CSS; tokens generate utilities by namespace; live in `globals.css` next to component styles |
| `framer-motion` npm package | `motion` npm package (rebranded) | 2024 | Same API surface; just rename imports from `framer-motion` → `motion/react` |
| `whisper-1` (Phase 2 ref) | `gpt-4o-mini-transcribe` | OpenAI announced 2024-Q4 | Cheaper + more accurate; only Whisper-1 advantage is word-level timestamps which we don't need |
| Vercel Hobby 10s function timeout | Vercel Hobby 300s with Fluid Compute | Fluid Compute default for new projects since 2025-04-23 | SSE for 30–60s pipelines runs comfortably on Hobby |
| `EventSource` for SSE on the client | `fetch().body.getReader()` with `TextDecoderStream` | Always for POST-based SSE | `EventSource` is GET-only; our route is POST |
| Multi-route mock vs real (`/api/extract-mock`, `/api/extract`) | Single route + env-var service factory | ARCHITECTURE.md pattern | Frontend never knows the mode; one env-var swap goes prod |
| Hand-written TS `Workout` interface + Zod schema (drift) | Single Zod schema + `z.infer<typeof WorkoutSchema>` | Standard 2024+ TS pattern | Zero drift; same schema constrains LLM in Phase 2 |
| Geist via `next/font/google` (with `Geist` + `Geist_Mono` imports) | `geist` npm package (`geist/font/sans`, `geist/font/mono`) | Vercel published the npm package | Self-hosted woff2 ships with the package; no Google Fonts fetch at build time |
| `compressToBase64` + URL-encode manually | `compressToEncodedURIComponent` | lz-string built-in since pre-1.5 | One call; URL-safe output |

**Deprecated/outdated patterns the planner should NOT introduce:**
- `getServerSideProps` / `pages/` directory (App Router only).
- `Inter` + `Outfit` font pairing — user chose Geist (D-02).
- Zustand / Redux / Jotai — `useReducer` is the locked choice.
- `XState` for state machine — `useReducer` is enough at 5 states.
- `react-hot-toast` — `sonner` is shadcn-blessed and used here.

## Validation Architecture

**Skipped** — `.planning/config.json` has `workflow.nyquist_validation: false`. Per the research protocol, this section is omitted by configuration.

The planner should still include the schema-round-trip Vitest test (`tests/schema.test.ts` parsing all 5 fixtures) and a `share-url-roundtrip.test.ts` (encode → decode → equality, including strip-chain when payload exceeds 2KB) as standard correctness tasks — both come from PITFALLS.md and the share contract, not from nyquist gating.

## Environment Availability

> Phase 1 is greenfield; the relevant dependencies are all installable via `pnpm` + `npx`. The "environment" probe is whether the host machine has the right Node and Git for a fresh setup.

| Dependency | Required By | Available (host check) | Version | Fallback |
|------------|------------|-----------------------|---------|----------|
| Node.js ≥ 20 LTS | Next 16, pnpm, Geist | check via `node --version` at plan exec | — | install via Volta/nvm |
| pnpm | All install steps | `pnpm --version` at plan exec | — | `corepack enable && corepack prepare pnpm@latest --activate` |
| Git | Version control + Vercel deploy | `git --version` at plan exec | — | install via system package manager |
| Vercel CLI (optional) | `vercel deploy` from CLI; alternative is GitHub-integration auto-deploy | `vercel --version` | — | use GitHub → Vercel integration (no CLI needed) |
| A web browser | Manual testing of the deployed demo | local | — | — |

**Missing dependencies with no fallback:** None — every dep has an install path or alternative.

**Missing dependencies with fallback:** Vercel CLI (use GitHub integration if missing).

**Note:** No system-level binaries are required for Phase 1 (no yt-dlp, ffmpeg, Python — those are Phase 2/3 sidecar concerns). The mock-only Phase 1 build is entirely Node + browser.

## Security Domain

> `.planning/config.json` does not set `security_enforcement`; per the protocol, treat as enabled. Phase 1 is mock-only with no real user data, no auth, and no secrets that aren't `EXTRACT_MODE` (non-sensitive). Security scope is therefore narrow but not zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1 |
| V3 Session Management | no | No sessions |
| V4 Access Control | partial | `/api/extract` is anonymous and intentionally public; rate limiting is Phase 2 (out of scope here). Phase 1 does enforce client-side URL allow-list (INPT-02 — YouTube-only regex) as a *defense*, not a security control. |
| V5 Input Validation | **yes** | All input through `ExtractRequestSchema.safeParse()` server-side AND client-side YouTube regex; share-link payload validated via `WorkoutSchema.parse()` before render |
| V6 Cryptography | no | No crypto in Phase 1 (lz-string is compression, not encryption — share payloads are public by design) |
| V7 Error Handling | yes | Errors surface user-friendly messages; never leak stack traces; Zod errors mapped to `code: UNKNOWN` |
| V11 Business Logic | partial | URL keyword routing (`fail`/`empty`/`rate-limit`) is demo-only and not exposed in production messaging |
| V13 API & Web Service | yes | SSE route validates input, sets `Cache-Control: no-store` semantics (via `no-transform`), no CORS opened to wildcard origins |
| V14 Configuration | yes | `EXTRACT_MODE` documented in `.env.example`; no secrets committed; `vercel.json` minimal and reviewed |

### Known Threat Patterns for {Next.js 16 + Vercel + Anonymous Public Demo}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via `url` body param to `/api/extract` | Information Disclosure | Phase 1 mock never `fetch()`es the URL — it parses and hashes it. The threat shape exists for Phase 2 (when real backend hits YouTube); mitigated by allow-listing `youtube.com` / `youtu.be` and using only the `videoId` to call captions API. |
| Reflected XSS via share-link payload | Tampering | Share payload is JSON, parsed and validated through Zod before render; no `dangerouslySetInnerHTML` anywhere; all schema strings render as React text nodes (escaped by default). |
| Open redirect | Tampering | None — Phase 1 has no redirects. |
| Prototype pollution via JSON.parse | Tampering | Zod's parse rejects unknown keys when configured (`z.object({...}).strict()` if desired); reasonable default is to accept unknown keys but never use them, which Zod does already. |
| DoS via large `?w=` payload | DoS | Browser URL-length limits (~8KB) cap incoming payload; D-17 strip chain caps outgoing. Bound the decompressed size with a sanity check (e.g., `if (json.length > 50_000) throw`) before parsing. |
| Clickjacking on the deployed demo | Tampering | Default Vercel headers include `X-Frame-Options: SAMEORIGIN` for the framework's pages; verify via `curl -I` on deployed URL. |
| Malicious clipboard payload (no relevant attack surface here) | n/a | We only write to clipboard, never read sensitive paste content into the app (we only read on the URL input, which is user-driven). |
| Supply chain attack via npm dep | Tampering | Slopcheck + npm registry verification done in this research; pin versions via `pnpm-lock.yaml`. |

**Phase 1 security gate:** Plan 1 includes a task to verify (a) `Content-Security-Policy` header (Vercel default is permissive — Phase 1 ships without custom CSP; revisit when first real user data appears), (b) `Strict-Transport-Security` (Vercel default sends this), (c) no secrets in `.env.local` committed (only `EXTRACT_MODE`), (d) Vercel Spend Management cap configured at $20 (even on a mock-only demo, cap protects against pathological function-invocation costs).

## Assumptions Log

> Claims tagged `[ASSUMED]` are based on training knowledge or single-source patterns and need user/planner confirmation before becoming locked. Most claims in this research are `[VERIFIED]` or `[CITED]` from authoritative sources.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind 4's `@theme inline` directive correctly bridges shadcn CSS vars to utility class generation in Next 16's `globals.css`. | Code Examples §Tailwind 4 + Pitfall 8 | LOW — verified in shadcn docs but specific Next 16 + Tailwind 4.3 combination should be smoke-tested in Plan 1's foundation task (add a `<Button>` and confirm `bg-primary` resolves). |
| A2 | The `geist@1.7.0` npm package's `GeistSans.variable` and `GeistMono.variable` exports work identically in Next 16 RSC as they did in Next 14/15. | Code Examples §Layout | LOW — verified by npm package readme and Vercel font docs, but Next 16 RSC font handling has shifted; planner verifies by checking zero-CLS in Lighthouse on first deploy. |
| A3 | The 5 fixture sizes (when compressed with lz-string) fit under the 2KB strip threshold for all but the 12-exercise hypertrophy case. | Pitfall 4 | MEDIUM — needs measurement at fixture build time (Plan task: log `compressed.length` for each fixture). If 6+ exercises commonly exceed 2KB, the strip threshold may need raising to 4KB. |
| A4 | URL-keyword routing for error states (`fail`/`empty`/`rate-limit`) doesn't conflict with real YouTube video IDs (which match `[A-Za-z0-9_-]{11}`). | Code Examples §Mock | LOW — YouTube IDs are 11 chars of `[A-Za-z0-9_-]`; "fail", "empty", "rate-limit" as substring matches are intentional (demo-special URLs, not real IDs). Conflict requires a real video ID containing those substrings — possible but vanishingly unlikely to be pasted in a demo flow. |
| A5 | Vercel's `text/event-stream` response with `X-Accel-Buffering: no` is not buffered by Vercel's edge layer for Node-runtime route handlers under Fluid Compute. | Pitfall 1 + Code Examples §SSE Route | LOW — community-corroborated by Upstash blog, Medium SSE fix article, and Vercel community thread; Vercel's official Fluid Compute docs cite SSE as a supported pattern for AI workloads. Smoke-test on first deploy. |
| A6 | The `pnpm dlx shadcn@latest init` flow in May 2026 still asks the same questions documented in earlier shadcn docs (TypeScript, style, base color, CSS variables, RSC, components dir). | Stack Installation | LOW — shadcn CLI is a moving target. Planner should treat the answers as a checklist (TypeScript yes, style default, base "slate", CSS vars yes, RSC yes, components in `components/ui`); if the CLI asks new questions, the planner picks the obvious answer and documents it in CONVENTIONS.md. |
| A7 | `useReducedMotion()` from `motion/react` correctly returns `true` on macOS/iOS Reduce Motion AND Windows "Show animations in Windows" off AND Android "Remove animations." | Pitfall 7 + Code Examples §Motion | LOW — Motion's docs assert "all reduced motion settings" — single hook covers OS-level toggles. Verify on macOS in Plan 1; Phase 2 can extend to multi-platform if defect-found. |
| A8 | `parseYouTubeUrl` regex covers `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` — and the cleaning step strips all known tracking params (`si`, `feature`, `t`, `list`, `index`, `pp`, `utm_*`). | Code Examples §YouTube URL Parser | MEDIUM — the tracking param list is best-effort. New YouTube features (live, embed, music) may not match. Phase 1 narrowly scopes to "URL that looks like YouTube video"; edge cases (live streams, music videos) are acceptable to mishandle in v1 (mock returns a fixture anyway). |
| A9 | Plan 1's MVP-mode deliverable should be the smallest end-to-end vertical slice: paste demo URL → SSE → fixture renders → share works → deployed. The full 14-component inventory in UI-SPEC §8.2 ships across Plan 2+. | (planner-facing — not a section) | LOW — directly follows from ROADMAP `Mode: mvp` for Phase 1 and the "walking skeleton" concept. Planner confirms by emitting `SKELETON.md` per spec. |
| A10 | Vercel Hobby plan's `vercel.json` doesn't need an explicit `{ "fluid": true }` because Fluid Compute is on by default for new projects since 2025-04-23. | Pitfall 1 + Standard Stack | LOW — verified in Vercel docs (`vercel.com/docs/fluid-compute`). However, the planner SHOULD ship a minimal `vercel.json` with the literal `{ "$schema": "https://openapi.vercel.sh/vercel.json" }` to make Phase 2's potential additions easier. |

## Open Questions

1. **Will the 12-exercise hypertrophy fixture's compressed share-link payload fit under 2KB without stripping?**
   - What we know: 12 × ~150–300 bytes per exercise raw ≈ 2.5–4 KB raw; lz-string compresses ~40–70% → ~1–2 KB compressed.
   - What's unclear: actual bytes-after-compression depends on field overlap and string length.
   - Recommendation: Plan 1 includes a measurement task — log `compressed.length` for each fixture; if any fixture exceeds 2048 chars, log which strip-chain step brings it under. Document threshold-impacting fixtures in CONVENTIONS.md so Phase 2's real backend doesn't surprise users on first-time real-extracted shares.

2. **Should the `?w=` decode produce a brief "Loading…" flash on share-link visits to avoid the input-flash pattern?**
   - What we know: A useEffect-based decode produces one frame of `<UrlInput />` before the workout view replaces it.
   - What's unclear: whether the user perceives the flash on a fast device (probably no) and whether the planner wants to optimize this now or in Phase 4 polish.
   - Recommendation: ship the simpler effect-based decode in Phase 1. If user testing in Phase 2 surfaces complaints, swap to server-side pre-decode via `page.tsx` searchParams.

3. **Should the `X-Accel-Buffering: no` header be set via `vercel.json` route headers, or only inline in the route handler?**
   - What we know: header-in-Response works on Vercel per community sources.
   - What's unclear: whether `vercel.json` `headers` directives stack additively or replace.
   - Recommendation: set inline in `route.ts` Response only. Don't introduce `vercel.json` `headers` config in Phase 1 — keeps deploy config minimal and avoids the additive-vs-replace question.

4. **Is `WorkoutSchema.parse()` at module-load time safe in a Vercel function (cold start cost)?**
   - What we know: Zod parsing of 5 JSON fixtures (each ~3–10KB) takes <10ms at module load on modern hardware.
   - What's unclear: cold-start tail-latency impact when Vercel boots a new Fluid Compute instance.
   - Recommendation: keep the module-load parse as designed (D-14). If cold-start metrics in Phase 2 show >50ms attributable to this, lazy-parse on first request instead.

5. **Should `<ExtractFlow />` use `useTransition` / `useDeferredValue` for the SSE event dispatch loop?**
   - What we know: `dispatch()` on each SSE event is cheap (~1ms); React 19 batching handles it.
   - What's unclear: whether the 50–80ms cascade animation interacts badly with high-frequency dispatch.
   - Recommendation: ship without `useTransition`; if frame-drop is observed during cascade on low-end devices in Phase 1 review, wrap dispatch in `startTransition`.

## Walking Skeleton (Phase 1 MVP exit gate)

> Per `.planning/config.json` mode-yolo + ROADMAP `Mode: mvp` + Phase 1 + no prior summaries, the planner emits `SKELETON.md` alongside `PLAN.md`. The skeleton scope is below.

**Minimum end-to-end slice that validates "every visible product behavior works":**

1. **Paste a YouTube URL** (any URL, since mock uses hash-mod-N fixture selection) → URL validates → CTA enables.
2. **SSE stage events stream** to the UI: 4 stages render with pulse-dot, checkmarks accumulate, 4 skeleton cards visible.
3. **Single fixture renders** (the baseline `dumbbell-leg-day.json` with one superset) in glass cards with cascade animation.
4. **Copy as Markdown** copies a sane markdown representation to clipboard; toast confirms.
5. **Copy as Plain Text** copies a Notes-friendly representation; toast confirms.
6. **Share Workout** generates a `?w=…` URL, copies it; opening it in a new tab renders the same workout with cascade *disabled* (instant render).
7. **Error states demonstrated:** pasting `https://youtube.com/watch?v=fail-demo-1` triggers NETWORK error UI; `empty-demo-1` triggers NO_WORKOUT; `rate-limit-demo-1` triggers RATE_LIMITED.
8. **Deployed to Vercel** at a stable preview/production URL; share-link works from another browser/device.

**Out of skeleton (defer to Plan 2+ within Phase 1):**
- All 5 fixtures (skeleton ships with 1 baseline fixture).
- Long-fixture strip chain D-17 (skeleton ships with strip-disabled path; payload size validated separately).
- Full reduced-motion compliance across all 7 motion moments (skeleton ships with global CSS toggle; per-Motion-hook gating refined in Plan 2+).
- Mobile glassmorphism fallback (skeleton ships with desktop happy path; fallback added in Plan 3).
- WCAG axe-core verification (skeleton ships; verification is the Wave 4 gate).
- All 14 components from UI-SPEC §8.2 (skeleton ships the critical path: `<UrlInput />`, `<LoadingStages />`, `<WorkoutView />`, `<ExerciseCard />`, `<SupersetCard />`, `<AmbientBackground />`, `<ActionBar />`; everything else is supporting polish).

The skeleton validates the **architecture** — schema, SSE contract, state machine, mock-real swap, share encode/decode. Once it ships, additional plans extend coverage (4 more fixtures, strip chain, mobile fallback, full motion compliance, axe-core verification) without changing the architecture.

## Sources

### Primary (HIGH confidence)

- [Next.js 16 Route Handler docs](https://nextjs.org/docs/app/api-reference/file-conventions/route) — verified streaming pattern, route-segment config (`maxDuration`, `dynamic`, `runtime`)
- [Tailwind 4 @theme documentation](https://tailwindcss.com/docs/theme) — CSS-first config, namespace-drives-utilities, `@theme inline` for vars-to-utility bridge
- [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming) — CSS variable structure, Tailwind 4 integration, primary/accent customization
- [Motion 12 AnimatePresence docs](https://motion.dev/docs/react-animate-presence) — `mode="wait"`, key-based detection, exit animations
- [Motion 12 useReducedMotion hook docs](https://motion.dev/docs/react-use-reduced-motion) — runtime-updating hook, OS-toggle responsiveness
- [Zod 4 discriminatedUnion docs](https://zod.dev/api?id=discriminated-unions) — literal-tagged variants, parse-and-narrow, performance vs `union`
- [Vercel Fluid Compute docs](https://vercel.com/docs/fluid-compute) — default-on for new projects since 2025-04-23, 300s Hobby max, all runtimes supported
- [Geist font npm package](https://www.npmjs.com/package/geist?activeTab=readme) — verified `geist@1.7.0` exports `geist/font/sans` and `geist/font/mono`
- [lz-string GitHub README](https://github.com/pieroxy/lz-string) — verified `compressToEncodedURIComponent` URL-safe behavior; `1.5.0` is current stable
- Project research bundle (HIGH confidence per its own metadata):
  - `.planning/research/ARCHITECTURE.md` — RSC + Client island, useReducer FSM, service factory, SSE pattern
  - `.planning/research/STACK.md` — verified npm versions, prescriptive choices
  - `.planning/research/PITFALLS.md` §6 (glassmorphism) + §7 (fake loading) — Phase 1's two highest-leverage failure modes
  - `.planning/research/SUMMARY.md` — overall context and phase ordering rationale
- npm registry verification (`npm view <pkg> version repository.url` on 2026-05-17): `next@16.2.6`, `tailwindcss@4.3.0`, `motion@12.38.0`, `zod@4.4.3`, `lz-string@1.5.0`, `geist@1.7.0`, `lucide-react@1.16.0`, `sonner@2.0.7`, `clsx@2.1.1`, `tailwind-merge@3.6.0`, `next-themes@0.4.6` — all packages have linked source repositories

### Secondary (MEDIUM confidence — community/blog, useful patterns)

- [Upstash blog: SSE streaming LLM responses](https://upstash.com/blog/sse-streaming-llm-responses) — concrete `ReadableStream` + `TextEncoder` example for Next.js Route Handlers
- [Medium: Fixing slow SSE on Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) — `X-Accel-Buffering: no` + `force-dynamic` requirement
- [Next.js SSE Guide 2026](https://nextjslaunchpad.com/article/nextjs-server-sent-events-real-time-notifications-progress-tracking-live-dashboards) — confirms header set and dynamic config
- [Josh W. Comeau: prefers-reduced-motion React](https://www.joshwcomeau.com/react/prefers-reduced-motion/) — companion to Motion's hook for non-Motion CSS animations (gradient orbs case)
- [caniuse: backdrop-filter](https://caniuse.com/css-backdrop-filter) — 92% global support; mobile Chrome and Safari covered; Firefox needs prefix in older versions
- [Tutorialpedia: backdrop-filter Safari issue](https://www.tutorialpedia.org/blog/backdrop-filter-css-not-blurring-text/) — `-webkit-` prefix requirement for Safari < 17

### Tertiary (LOW confidence — single-source community, verify on first use)

- [Slopcheck (running locally with the user's installed CLI)](https://github.com/Endorsanity/slopcheck) — useful but ecosystem-blind (defaulted to PyPI for Node packages); manual npm verification was the authoritative check
- Mock-vs-real swap pattern (CONTEXT.md `<code_context>` + ARCHITECTURE.md Pattern 3) — well-established in TS communities, not from a canonical document

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified against live npm registry on 2026-05-17 with source repo confirmed; versions current.
- Architecture: HIGH — RSC + Client island, useReducer FSM, service factory, SSE-via-ReadableStream all verified against Next.js 16 official docs and confirmed by community SSE-on-Vercel write-ups.
- Tailwind 4 + shadcn integration: MEDIUM-HIGH — official Tailwind 4 docs cover `@theme inline`; shadcn's exact CLI behavior in May 2026 is `[ASSUMED A6]` (small risk: CLI may add questions).
- Motion 12 patterns: HIGH — official docs confirm `AnimatePresence`, variants/stagger, `useReducedMotion`, runtime-updating hook.
- Zod 4 schema patterns: HIGH — discriminatedUnion, literal types, infer all verified in current docs.
- Vercel Fluid Compute + SSE: HIGH — official docs confirm default-on, 300s Hobby max, Node runtime support; SSE pattern community-corroborated.
- lz-string share URLs: HIGH on the encode/decode mechanics, MEDIUM on actual payload sizes for our specific fixtures (`[ASSUMED A3]` — measurable in Plan 1).
- Glassmorphism mobile-perf fallback: MEDIUM — `@supports (backdrop-filter: blur(1px))` feature detection is correct; real-device performance behavior on mid-range Android is the open variable (STATE.md flagged this as a Phase 1 concern).
- Common pitfalls: HIGH — each pitfall is anchored to either a community-corroborated SSE-on-Vercel failure mode, a project-research PITFALLS.md entry, or a direct UI-SPEC mitigation.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days for stable libraries — Motion 12, Zod 4, Tailwind 4, Next 16 are not on weekly release cycles). Revalidate `npm view` for current versions before starting Plan 1.

---

*Research drafted: 2026-05-17. Source context: CONTEXT.md (19 locked decisions), UI-SPEC.md (16 sections of visual/interaction contract), REQUIREMENTS.md (36 Phase 1 REQ-IDs), STACK.md, ARCHITECTURE.md, PITFALLS.md §6 + §7, SUMMARY.md, plus live npm registry + Next.js 16 official docs + Tailwind 4 official docs + Motion 12 official docs + Zod 4 official docs + Vercel Fluid Compute official docs.*
