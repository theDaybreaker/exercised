# Requirements: Exercised

**Defined:** 2026-05-16
**Core Value:** Paste a YouTube workout video URL → see a clean, structured, readable workout in seconds. Premium aesthetic + extraction quality are the product.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases. All `v1` is anonymous (no accounts, no DB, YouTube-only).

### Input

- [x] **INPT-01**: User can paste a YouTube URL into a prominent landing-page input and submit via Enter or a primary "Extract Workout" CTA
- [x] **INPT-02**: Client-side YouTube URL validation rejects non-YouTube and malformed URLs before submit, with inline error
- [x] **INPT-03**: URL field supports paste from clipboard with auto-trim of whitespace and tracking parameters

### Schema & Contract

- [x] **SCHM-01**: A single Zod schema (`lib/schema/workout.ts`) defines the `Workout` shape and is the source of truth for fixtures, the LLM `generateObject` call, and frontend types
- [x] **SCHM-02**: Schema includes top-level fields: `workout_title`, `creator_username`, `target_muscles[]`, `estimated_duration_mins`, `routine[]`, plus `extraction_confidence` and `schema_version`
- [x] **SCHM-03**: Each exercise (standard and within superset) carries `startTimestamp`, `sourceQuote`, `equipment[]` fields — locked in v1 schema even when not all rendered yet
- [x] **SCHM-04**: Workout-level `difficulty` (beginner / intermediate / advanced) field is in the schema and rendered as a header chip
- [x] **SCHM-05**: Schema supports the `standard_set` and `superset` routine entry types from the brief, byte-for-byte compatible with the brief's example JSON

### Loading & Pipeline UX

- [x] **PIPE-01**: `/api/extract` returns a streamed `text/event-stream` response (SSE) emitting stage events: `fetching → transcribing → analyzing → generating → result | error`
- [x] **PIPE-02**: Mock implementation of `/api/extract` returns fixture JSON via the same SSE stage events (real backend swap is a service-layer change, not a route change)
- [x] **PIPE-03**: Mock pipeline completes in ~3 seconds with stage transitions visible to the user
- [x] **PIPE-04**: Loading UI cycles stage labels driven by real SSE events (not faked `setTimeout`); each stage has a minimum 300ms dwell for polish
- [x] **PIPE-05**: Loading state shows skeleton workout cards in addition to the stage label
- [x] **PIPE-06**: An `EXTRACT_MODE` env var selects mock vs. real `ExtractionService` at runtime; frontend is unaware of the switch

### Workout Output View

- [x] **OUTV-01**: Output view renders workout title, creator username, estimated duration, and target muscles as styled pill tags in a header section
- [x] **OUTV-02**: Difficulty chip (beginner/intermediate/advanced) renders in the header when present in the schema
- [x] **OUTV-03**: Exercise list is scrollable and renders each `standard_set` as an exercise card with name, sets, reps, rest, and an expandable "Form Cues" toggle
- [x] **OUTV-04**: `superset` entries render as a visually-grouped bracketed card containing the inner exercises and a single shared rest indicator
- [x] **OUTV-05**: A "Watch on YouTube" link / button is visible on the output, linking to the source video and crediting the creator *(Phase 1 stub: links to `@creator` channel; per-video link requires `video_url` schema field — added in Phase 2 when real captions pipeline yields the source URL)*
- [x] **OUTV-06**: A footer-level AI-disclaimer line is present on the output ("AI-extracted; verify form and reps in the source video")
- [x] **OUTV-07**: Output view is fully mobile-responsive — touch-target sizes meet 44px minimum and cards reflow on phone widths

### Save & Share (No-Auth)

- [x] **SHRE-01**: "Copy as Markdown" copies the workout to clipboard formatted as readable markdown
- [x] **SHRE-02**: "Copy as Plain Text" copies a clean plain-text variant suitable for Notes / WhatsApp
- [x] **SHRE-03**: "Share Workout" button generates a URL-encoded share link (compressed with `lz-string`) that recreates the workout view when opened — no backend round-trip, schema-version-aware

### Visual Design (Premium Dark-Mode)

- [x] **DSGN-01**: App renders dark-mode by default with ambient gradient background (vibrant color orbs, not flat black)
- [x] **DSGN-02**: Cards use glassmorphism (semi-translucent background, backdrop-blur, thin 10%-white border) with 10–15% card opacity for legibility
- [x] **DSGN-03**: A single accent color (neon green or electric blue) is applied consistently across CTAs, focus rings, and active stage indicators
- [x] **DSGN-04**: Typography uses Inter, Outfit, or Geist loaded via `next/font` with zero CLS
- [x] **DSGN-05**: Micro-animations on hover (cards lift / glow subtly) and on stage transitions during loading; respects `prefers-reduced-motion`
- [x] **DSGN-06**: WCAG 4.5:1 contrast ratio is met on all primary body text against the glassmorphic backgrounds

### Error & Empty States

- [x] **ERRS-01**: Invalid URL submitted → inline form error, no API call made
- [x] **ERRS-02**: Extraction failure (network, server, transcript missing) → friendly error state with retry CTA, distinct copy per failure reason
- [x] **ERRS-03**: No workout content detected in the video → honest empty state ("We couldn't find a workout in this video") rather than fabricated content
- [ ] **ERRS-04**: Low-confidence extraction surfaces a banner on the output explaining results may be incomplete

### Real Extraction Pipeline (AI)

- [ ] **EXTR-01**: `/api/extract` fetches YouTube captions via `youtube-caption-extractor` with `youtube-transcript` as fallback before considering audio transcription (captions-first path)
- [ ] **EXTR-02**: Extracted text is structured into the `Workout` schema via Vercel AI SDK `generateText({ output: Output.object(WorkoutSchema) })` against GPT-4o with OpenAI Structured Outputs (AI SDK 6 canonical API)
- [ ] **EXTR-03**: Hallucination guard: every exercise carries a `sourceQuote` validated to appear in the transcript before being returned to the client
- [ ] **EXTR-04**: An eval set of 5–10 hand-labeled fitness videos (plus 1 non-fitness control) is checked in and used to gate real-pipeline ship; failure to extract the control as "no workout" blocks release
- [ ] **EXTR-05**: For videos without captions, audio is fetched via an off-Vercel transcript source (Supadata or Railway/Fly sidecar) and transcribed with `gpt-4o-mini-transcribe` before LLM structuring

### Cost Protection & Abuse

- [ ] **COST-01**: `videoId` cache (Upstash Redis, 30-day TTL) returns prior extractions for repeat URLs without an AI call
- [ ] **COST-02**: Per-IP rate limit via `@upstash/ratelimit` (sliding window, ~3–5 requests/min, ~20/day) on `/api/extract`
- [ ] **COST-03**: Global daily spend cap (tracked in Redis) halts new extractions when crossed, with a friendly "We're popular today — try again tomorrow" state
- [ ] **COST-04**: OpenAI dashboard budget cap and Vercel Spend Management cap are configured before the first real key is deployed
- [ ] **COST-05**: Pre-Whisper video duration cap (e.g., 30 min) prevents single-request cost blow-up on the audio path

### Deployment & Operations

- [x] **OPS-01**: App deploys to Vercel from `main` with one-click rollback
- [x] **OPS-02**: Mock-mode demo is deployed and shareable from the end of Phase 1
- [x] **OPS-03**: `/api/extract` route uses Vercel Fluid Compute with `maxDuration = 300`
- [ ] **OPS-04**: DMCA contact page and basic ToS/AI-disclaimer page exist before the real pipeline ships
- [ ] **OPS-05**: Daily smoke test extracts a known-good YouTube video and alerts on failure (yt-dlp / caption-API drift)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Trust & Polish (post-v1)

- **POLI-01**: Per-exercise "↪ jump to timestamp" link that opens the YouTube video at `startTimestamp`
- **POLI-02**: Per-exercise source-quote popover surfacing the transcript evidence (`sourceQuote`)
- **POLI-03**: Equipment chips rendered per exercise (`equipment[]`)
- **POLI-04**: Anatomy silhouette mini-diagram with highlighted target muscles
- **POLI-05**: Print stylesheet for a clean printable workout sheet
- **POLI-06**: Inline edit of numeric fields (sets/reps/rest) before copy/share — corrections without re-extraction
- **POLI-07**: Recently-extracted URLs surfaced in localStorage history on the landing page
- **POLI-08**: "⚡ Cached" badge when the result is a cache hit

### Coverage & Reliability

- **COVR-01**: TikTok ingestion (when scraping stabilizes or via a hosted service)
- **COVR-02**: Instagram Reels ingestion
- **COVR-03**: Multi-language transcript support (non-English workouts)
- **COVR-04**: Generated quality eval dashboard tracking caption-vs-Whisper accuracy on real videos

### Future Surface Area

- **NXTM-01**: User accounts and saved-workouts library
- **NXTM-02**: Active workout tracker (check off sets, log weights, rest timer) — likely first native-mobile feature
- **NXTM-03**: Native mobile app

## Out of Scope

Explicitly excluded for v1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / auth | Largest scope multiplier; defer until extraction is proven valuable |
| Active workout tracker (set logging, weights, rest timer) | "Trackable" in v1 means *viewable as a structured routine* — interactive logging is mobile territory |
| TikTok ingestion | Scraping is fragile and breaks when TikTok changes; revisit after YouTube proves out |
| Instagram Reels ingestion | Auth-walled, requires cookies or paid scraping API; cost/benefit fails for v1 |
| Native mobile app | Future milestone; web ships first |
| Saving / favoriting workouts (server-side) | Requires auth — paired decision |
| Payments / subscriptions | Premature before extraction quality is validated |
| Multi-language extraction | English-only in v1; LLM prompt is tuned for English fitness vocabulary |
| AI chatbot on output | Anti-feature; drains budget and distracts from the extract-and-go loop |
| Generated exercise illustrations | Actively harms trust when fabricated; defer until verified imagery is available |
| Social feed / following creators | Out of v1 product shape — Exercised is a tool, not a network |
| In-product paywall or sign-up wall | The brief is "extract and view fast" — a wall kills conversion |
| Running yt-dlp inside a Vercel function | Confirmed by research to be a project-killer (datacenter-IP blocks, 250 MB limit, PoToken requirements) |

## Traceability

Updated during roadmap creation by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPT-01 | Phase 1 | Complete |
| INPT-02 | Phase 1 | Complete |
| INPT-03 | Phase 1 | Complete |
| SCHM-01 | Phase 1 | Complete |
| SCHM-02 | Phase 1 | Complete |
| SCHM-03 | Phase 1 | Complete |
| SCHM-04 | Phase 1 | Complete |
| SCHM-05 | Phase 1 | Complete |
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-03 | Phase 1 | Complete |
| PIPE-04 | Phase 1 | Complete |
| PIPE-05 | Phase 1 | Complete |
| PIPE-06 | Phase 1 | Complete |
| OUTV-01 | Phase 1 | Complete |
| OUTV-02 | Phase 1 | Complete |
| OUTV-03 | Phase 1 | Complete |
| OUTV-04 | Phase 1 | Complete |
| OUTV-05 | Phase 1 | Complete |
| OUTV-06 | Phase 1 | Complete |
| OUTV-07 | Phase 1 | Complete |
| SHRE-01 | Phase 1 | Complete |
| SHRE-02 | Phase 1 | Complete |
| SHRE-03 | Phase 1 | Complete |
| DSGN-01 | Phase 1 | Complete |
| DSGN-02 | Phase 1 | Complete |
| DSGN-03 | Phase 1 | Complete |
| DSGN-04 | Phase 1 | Complete |
| DSGN-05 | Phase 1 | Complete |
| DSGN-06 | Phase 1 | Complete |
| ERRS-01 | Phase 1 | Complete |
| ERRS-02 | Phase 1 | Complete |
| ERRS-03 | Phase 1 | Complete |
| OPS-01 | Phase 1 | Complete |
| OPS-02 | Phase 1 | Complete |
| OPS-03 | Phase 1 | Complete |
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Pending |
| EXTR-03 | Phase 2 | Pending |
| EXTR-04 | Phase 2 | Pending |
| COST-01 | Phase 2 | Pending |
| COST-02 | Phase 2 | Pending |
| COST-03 | Phase 2 | Pending |
| COST-04 | Phase 2 | Pending |
| ERRS-04 | Phase 2 | Pending |
| OPS-04 | Phase 2 | Pending |
| OPS-05 | Phase 2 | Pending |
| EXTR-05 | Phase 3 | Pending |
| COST-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0
- Phase 1: 36 requirements
- Phase 2: 11 requirements
- Phase 3: 2 requirements

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-17 — Phase 1 complete (DSGN-05/06 closed; OUTV-05 stub annotation added).*
