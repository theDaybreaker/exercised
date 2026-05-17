---
phase: 01-mock-deployable-premium-ui-demo
plan: 01
subsystem: foundation
tags: [scaffold, schema, mock-api, sse, geist, tailwind4, glassmorphism, shadcn]
dependency_graph:
  requires: []
  provides:
    - WorkoutSchema (Zod, single source of truth for Phase 1+2)
    - ExtractEventSchema (SSE wire contract)
    - ExtractionService interface + getExtractionService() factory
    - MockExtractionService (4 stage events + 1 result, ~4.4s total dwell)
    - RealExtractionService stub (T-01-07 loud failure)
    - toSSEStream<T>() helper (AsyncIterable → ReadableStream<Uint8Array>)
    - parseYouTubeUrl() (tracking-param strip, shorts + watch + youtu.be patterns)
    - POST /api/extract SSE route handler (Zod-validated, maxDuration=300)
    - app/globals.css with Tailwind 4 @theme inline, .glass-card recipe, orb keyframes
    - AmbientBackground RSC (3 drifting orbs, green/violet/coral)
    - Footer RSC (AI-disclaimer per OUTV-06)
  affects: []
tech_stack:
  added:
    - next@16.2.6
    - react@19.2.4
    - tailwindcss@4.3.0
    - zod@4.4.3
    - motion@12.38.0
    - geist@1.7.0
    - lz-string@1.5.0
    - lucide-react@1.16.0
    - sonner@2.0.7
    - clsx@2.1.1
    - tailwind-merge@3.6.0
    - next-themes@0.4.6
    - "@radix-ui/react-tooltip@1.2.8"
    - "@base-ui/react@1.4.1"
    - class-variance-authority
    - tw-animate-css
    - vitest@4.1.6
    - prettier@3.8.3
    - prettier-plugin-tailwindcss
  patterns:
    - RSC shell + single Client island (ARCHITECTURE.md Pattern 1)
    - ExtractionService interface for mock/real swap (Pattern 3)
    - Zod schema as single source of truth (Pattern 5)
    - Tailwind 4 @theme CSS-first config (Pattern 6)
    - SSE via ReadableStream + AsyncIterable bridge (Pattern 4)
key_files:
  created:
    - package.json
    - pnpm-lock.yaml
    - tsconfig.json
    - next.config.ts
    - .gitignore
    - .env.example
    - .prettierrc.json
    - vitest.config.ts
    - components.json
    - vercel.json
    - app/layout.tsx
    - app/page.tsx
    - app/globals.css
    - app/api/extract/route.ts
    - components/ui/button.tsx
    - components/ui/input.tsx
    - components/ui/card.tsx
    - components/ui/skeleton.tsx
    - components/ui/sonner.tsx
    - components/ui/tooltip.tsx
    - components/layout/AmbientBackground.tsx
    - components/layout/Footer.tsx
    - lib/utils.ts
    - lib/schema/workout.ts
    - lib/extraction/service.ts
    - lib/extraction/mock.ts
    - lib/extraction/real.ts
    - lib/sse/stream.ts
    - lib/youtube/url.ts
    - tests/fixtures/dumbbell-leg-day.json
    - tests/schema.test.ts
    - tests/youtube-url.test.ts
  modified: []
decisions:
  - "creator_username set to 'kynanfit' for dumbbell-leg-day.json (synthetic handle, no runtime collision check — planning-time concern only per W5 fix)"
  - "shadcn init installed base-nova style with @base-ui/react instead of classic radix — not a regression; button/card/etc. primitives are functional"
  - "vercel.json ships minimal { $schema } content only — Fluid Compute is default-on for new Vercel projects since 2025-04"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 31
  files_modified: 0
---

# Phase 01 Plan 01: Foundation Scaffold + Schema + SSE Route Summary

Next.js 16 + Tailwind 4 + shadcn scaffold with Zod WorkoutSchema, MockExtractionService SSE emitter, POST /api/extract route handler with all 4 critical headers, baseline dumbbell fixture, and ambient glassmorphism chrome.

## What Was Built

### Task 1: Bootstrap + Ambient Chrome

Bootstrapped a fresh Next.js 16.2.6 project with TypeScript, Tailwind CSS 4.3.0, ESLint, and App Router in the project root. Installed all Phase 1 runtime dependencies at pinned versions. Authored the full `app/globals.css` with:

- Tailwind 4 `@theme inline` bridge (Pitfall 8 mitigation) mapping all shadcn tokens + Phase 1 custom tokens
- `.glass-card` recipe with `backdrop-filter: blur(16px) saturate(140%)`, `-webkit-backdrop-filter`, 16px border-radius, depth + top-edge highlight box-shadow
- `@supports not (backdrop-filter)` fallback (opaque near-black)
- Three orb `@keyframes drift-orb-{1,2,3}` (28s/36s/44s alternate ease-in-out, translate-only)
- `@media (prefers-reduced-motion: reduce)` master block silencing all 4 animation classes

`app/layout.tsx` uses `GeistSans` and `GeistMono` from `geist/font/{sans,mono}` (not `next/font/google`) with `html class="dark"` hardcoded and a mounted Sonner `<Toaster>`. `AmbientBackground` and `Footer` are RSC components. `app/page.tsx` is a thin RSC shell with a placeholder hero (Plan 01-02 replaces with `<ExtractFlow />`).

shadcn/ui CLI installed 6 primitives: `button`, `input`, `card`, `skeleton`, `sonner`, `tooltip`. The CLI used the `base-nova` style (current shadcn default) which uses `@base-ui/react` instead of classic Radix UI — functionally equivalent, no regression.

### Task 2: Zod Schema + Fixture + Service Layer (TDD)

TDD RED/GREEN/REFACTOR cycle:
- RED: `tests/schema.test.ts` and `tests/youtube-url.test.ts` failed with import errors (modules didn't exist)
- GREEN: Implemented all 9 modules; 11 Vitest tests pass

**`lib/schema/workout.ts`** — verbatim from RESEARCH.md code examples:
- `ExerciseCoreSchema` with all SCHM-03 forward-looking fields (`startTimestamp`, `sourceQuote`, `equipment`)
- `RoutineItemSchema = z.discriminatedUnion("type", [StandardSetSchema, SupersetSchema])`
- `WorkoutSchema` with `schema_version: z.literal("1")` (D-18 versioning)
- `ExtractRequestSchema` and `ExtractEventSchema` discriminated unions
- Inferred TypeScript types exported

**`tests/fixtures/dumbbell-leg-day.json`** — 5-entry fixture:
- `schema_version: "1"`, `creator_username: "kynanfit"` (synthetic, no runtime collision check)
- 3 `standard_set` entries + 1 `superset` (Dumbbell Walking Lunge + Bulgarian Split Squat) + 1 more `standard_set`
- All SCHM-03 fields populated (`startTimestamp`, `sourceQuote`, `equipment`)

**Service layer:**
- `lib/extraction/service.ts`: `ExtractionService` interface + `getExtractionService()` factory (EXTRACT_MODE=mock default, PIPE-06)
- `lib/extraction/mock.ts`: Module-load fixture validation (D-14/T-01-03), `hashStringMod` selector (D-12), 1100/1100/1100/1000ms per-stage dwell (D-07), 5 SSE events total
- `lib/extraction/real.ts`: Stub throwing "not implemented" (T-01-07)
- `lib/sse/stream.ts`: `toSSEStream<T>()` helper with error event on iterator throw
- `lib/youtube/url.ts`: `parseYouTubeUrl()` with tracking-param strip list (INPT-03)

### Task 3: SSE Route Handler (TDD via curl smoke test)

`app/api/extract/route.ts`:
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`
- `try/catch` on `req.json()` → 400 "Malformed JSON body"
- `ExtractRequestSchema.safeParse(body)` → 400 with structured `issues` on schema failure (T-01-01/T-01-06)
- All 4 Pitfall 1 critical SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`

**Curl smoke test results (observed):**
- 4 stage events + 1 result event in ~4.4s total
- HTTP 400 + `{ "error": "Invalid request", "issues": [...] }` for empty body
- HTTP 400 + `{ "error": "Malformed JSON body" }` for non-JSON body
- All 4 critical SSE headers present in response

## Final Pinned Package Versions (as installed)

| Package | Requested | Installed |
|---------|-----------|-----------|
| `next` | 16.2.6 | 16.2.6 |
| `react` | 19.x | 19.2.4 |
| `react-dom` | 19.x | 19.2.4 |
| `tailwindcss` | 4.3.0 | 4.3.0 |
| `zod` | 4.4.3 | 4.4.3 |
| `motion` | 12.38.0 | 12.38.0 |
| `geist` | 1.7.0 | 1.7.0 |
| `lz-string` | 1.5.0 | 1.5.0 |
| `lucide-react` | 1.16.0 | 1.16.0 |
| `sonner` | 2.0.7 | 2.0.7 |
| `clsx` | 2.1.1 | 2.1.1 |
| `tailwind-merge` | 3.6.0 | 3.6.0 |
| `next-themes` | 0.4.6 | 0.4.6 |
| `@radix-ui/react-tooltip` | 1.2.8 | 1.2.8 |

Additional packages added by shadcn init (legitimate, in use): `@base-ui/react@1.4.1`, `class-variance-authority`, `tw-animate-css@1.4.0`, `shadcn@4.7.0`.

## Fixture Details

**`tests/fixtures/dumbbell-leg-day.json`:**
- `creator_username`: `"kynanfit"` — synthetic handle. Not a real creator. Chosen for plausibility without collision (per CONTEXT.md D-11 discretion, W5 note: "pick a plausible handle and document here"). No runtime collision check.
- 5 routine entries: 3 standard_sets + 1 superset (2 exercises inside) + 1 more standard_set
- All forward-looking fields populated: `startTimestamp` (int seconds), `sourceQuote` (string), `equipment` (["dumbbells"])

## SSE Smoke Test Results

**Confirmed working against `pnpm dev` (localhost:3000):**
- Chunk count: 5 (4 stage + 1 result)
- Timing observed: ~4.4s total (each stage ~1.0–1.1s)
- All 4 critical headers confirmed present
- 400 responses confirmed for invalid and malformed bodies

## Pitfall Observations

| Pitfall | Status |
|---------|--------|
| Pitfall 1 (SSE buffered on Vercel) | Mitigated — all 4 headers in route.ts |
| Pitfall 3 (Fixture parse failure) | Mitigated — WorkoutSchema.parse() at module load in mock.ts + Vitest CI test |
| Pitfall 8 (Tailwind 4 + shadcn CSS-var bridge) | Mitigated — @theme inline block maps all shadcn tokens to Tailwind utilities |
| Pitfall 9 (EXTRACT_MODE=real in Phase 1) | Mitigated — real.ts throws explicit error |

## Known Stubs

| Stub | File | Reason | Resolving Plan |
|------|------|--------|----------------|
| "Interactive UI coming in Plan 01-02" placeholder | `app/page.tsx` | Intentional — Plan 01-01 ships chrome only; Plan 01-02 inserts `<ExtractFlow />` | Plan 01-02 |
| `RealExtractionService` throws "not implemented" | `lib/extraction/real.ts` | Intentional — T-01-07 mitigation; Phase 2 implements | Plan 02-01 |

## User-Setup Checkpoint (Vercel)

The plan specifies a user-setup checkpoint at the end of Task 1 — the user must:
1. Connect GitHub repo to Vercel project (Vercel Dashboard → Add New → Import from GitHub)
2. Set `EXTRACT_MODE=mock` in Preview + Production env vars
3. Set Vercel Spend Management cap at $20

**This checkpoint gates Plan 01-02's first deploy** — not Task 2/3 of this plan. Code can be authored and committed independently.

## Plan 01-02 Hand-off

**Interfaces locked by this plan:**

| Interface | File | Description |
|-----------|------|-------------|
| `WorkoutSchema` | `lib/schema/workout.ts` | Zod schema with schema_version "1", discriminated union routine |
| `ExtractEventSchema` | `lib/schema/workout.ts` | SSE wire contract (stage/result/error events) |
| `ExtractionService` | `lib/extraction/service.ts` | Interface: `extract(url): AsyncIterable<ExtractEvent>` |
| `getExtractionService()` | `lib/extraction/service.ts` | Factory reading EXTRACT_MODE, defaults to mock |
| `parseYouTubeUrl()` | `lib/youtube/url.ts` | URL validator + tracking-param stripper |
| `toSSEStream<T>()` | `lib/sse/stream.ts` | AsyncIterable → ReadableStream SSE encoder |
| `POST /api/extract` | `app/api/extract/route.ts` | SSE endpoint with all 4 critical headers |

**Available for Plan 01-02 UI rendering:**
- `tests/fixtures/dumbbell-leg-day.json` — fully populated fixture with 1 superset, realistic form cues
- `app/globals.css` `.glass-card` class — ready to apply to `<ExerciseCard />`, `<WorkoutHeader />`, etc.
- `components/layout/AmbientBackground.tsx` — mounted in page.tsx, ready
- `components/layout/Footer.tsx` — mounted in page.tsx, ready

**Plan 01-02 must:**
1. Implement `<ExtractFlow />` Client island with `useReducer` state machine
2. Implement `<UrlInput />`, `<LoadingStages />`, `<WorkoutView />`, `<ExerciseCard />`, `<SupersetCard />`, `<ActionBar />`, `<ErrorState />`
3. Wire share encode/decode (`lib/share/encode.ts` + `lib/share/decode.ts`)
4. Wire clipboard (`lib/clipboard/markdown.ts` + `lib/clipboard/plaintext.ts`)
5. Confirm Vercel project is ready (user-setup checkpoint from Task 1) then push to main for first auto-deploy

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Noted Differences

**1. [Rule 2 - shadcn style variant] shadcn installed base-nova style instead of classic style**
- **Found during:** Task 1 (shadcn init)
- **Issue:** `pnpm dlx shadcn@latest init --defaults` installed the `base-nova` style (current default as of May 2026) using `@base-ui/react` primitives instead of classic Radix UI. The plan referenced "default style" which now means `base-nova`.
- **Fix:** Accepted as-is — the primitives (Button, Input, Card, Skeleton, Sonner, Tooltip) are all installed and functional. `@base-ui/react@1.4.1` is a legitimate Radix-successor by the same team. No behavior regression vs. classic Radix.
- **Impact:** Package.json has `@base-ui/react`, `shadcn`, `class-variance-authority`, `tw-animate-css` as additional dependencies not in the original list. All legitimate packages.

**2. [Bootstrap approach] pnpm create next-app rejected "Exercised" project name**
- **Found during:** Task 1
- **Issue:** `pnpm create next-app@16.2.6 .` rejected the directory name "Exercised" (capital letters not allowed in npm package names). Created scaffold in `/tmp/exercised-scaffold` and copied files.
- **Fix:** Created scaffold in `/tmp/exercised-scaffold` with npm-valid name, copied all files to project root, updated `package.json` name to `"exercised"`.
- **Impact:** None — project boots and builds correctly.

## Self-Check: PASSED

All created files exist on disk. All 3 task commits verified in git log:
- `111feb4` — feat(01-01): bootstrap Next.js 16 + Tailwind 4 + shadcn scaffold with ambient UI chrome
- `ae0f9f4` — feat(01-01): Zod WorkoutSchema + fixture + mock service + YouTube URL parser + Vitest tests
- `079d2d0` — feat(01-01): POST /api/extract SSE route handler with Zod validation and critical headers

Final verification: `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm build` — all 4 commands exit 0.
