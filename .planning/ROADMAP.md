# Roadmap: Exercised

## Overview

Three phases on a strict mock-first, captions-before-Whisper trajectory. Phase 1 ships a deployable premium UI demo against a mocked extraction pipeline — every visible behavior of the product works end-to-end on fixtures, including the SSE-driven loading UX, share-via-URL, copy-to-clipboard, error/empty states, and the locked JSON schema. Phase 2 swaps in real YouTube captions → GPT-4o structured extraction, gated by a hand-labeled eval set and shipped in the same PR as the full cost-protection stack (rate limit, cache, daily cap, budget caps, DMCA page, smoke test). Phase 3 closes coverage on uncaptioned videos via an off-Vercel transcript source + `gpt-4o-mini-transcribe`. Each phase delivers a shippable, demoable user-visible capability; nothing is internal-only.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Mock-Deployable Premium UI Demo** - Deployable Vercel demo: paste a YouTube URL, watch streamed pipeline stages, see a fully-rendered fixture workout in premium dark glassmorphism, copy/share/print, all error states wired
- [ ] **Phase 2: Real Captions Pipeline + Cost Protections** - Live extraction from real YouTube captions via GPT-4o structured outputs, eval-set ship gate, rate limit + cache + daily cap + budget caps + DMCA page + daily smoke test all live in the same release
- [ ] **Phase 3: Audio Fallback for Uncaptioned Videos** - Whisper-path coverage for videos without captions via off-Vercel transcript source, pre-Whisper duration cap

## Phase Details

### Phase 1: Mock-Deployable Premium UI Demo
**Goal**: Ship a deployed-to-Vercel demo URL where users can paste a YouTube URL, watch a real SSE-driven pipeline animation, and see a fully-rendered fixture workout in premium dark glassmorphism — every visible product behavior works end-to-end against fixtures
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INPT-01, INPT-02, INPT-03, SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, OUTV-01, OUTV-02, OUTV-03, OUTV-04, OUTV-05, OUTV-06, OUTV-07, SHRE-01, SHRE-02, SHRE-03, DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, ERRS-01, ERRS-02, ERRS-03, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. A live Vercel URL exists where a user can paste any YouTube URL into a prominent landing input and see a fully-rendered fixture workout (title, creator, duration, target-muscle pills, difficulty chip, exercise cards with sets/reps/rest/form-cues, supersets visually bracketed, "Watch on YouTube" link, AI-disclaimer footer) in premium dark glassmorphism within ~4–5 seconds (per D-07 — intentional cadence over ~3s)
  2. The loading experience streams real SSE stage events from `/api/extract` (fetching → transcribing → analyzing → generating) with skeleton workout cards visible, and an `EXTRACT_MODE` env var would swap mock → real without any frontend change
  3. From the rendered workout, the user can "Copy as Markdown", "Copy as Plain Text", and generate a "Share Workout" link that recreates the workout view on open with no backend round-trip
  4. Invalid URLs are rejected inline before any API call; extraction failures and no-workout-detected results land on distinct, honest error/empty states with retry, not fabricated content
  5. The Zod `Workout` schema in `lib/schema/workout.ts` is the single source of truth for fixtures and frontend types, includes forward-looking fields (`startTimestamp`, `sourceQuote`, `equipment[]`, `extraction_confidence`, `schema_version`), and is byte-compatible with the brief's example JSON
**Plans:** 5/5 plans executed
Plans:
- [x] 01-01-PLAN.md — Foundation: pnpm scaffold + shadcn init + tooling + Zod schema + service factory + mock + SSE route + base layout + ambient bg + footer + Vercel project setup
- [x] 01-02-PLAN.md — Skeleton UI: UrlInput + ExtractFlow + LoadingStages + WorkoutView + ExerciseCard + SupersetCard + ActionBar + share encode/decode (SharePayloadSchema wrapper) + clipboard + local verify + first Vercel deploy (OPS-02 pending GitHub push)
- [x] 01-03-PLAN.md — Fixture variety (5 fixtures, hash-mod-N selection) + URL-keyword error routing + ErrorState UI + inline URL validation polish
- [x] 01-04-PLAN.md — Share-encode D-17 strip chain loop body + D-18 schema-version error path polish + cross-fixture payload-size measurement
- [x] 01-05-PLAN.md — Per-moment reduced-motion compliance + mobile sticky-bottom ActionBar + tooltip disambiguation + axe-core WCAG remediation loop + Phase 1 exit gate (cross-device human smoke + STATE finalization)
**UI hint**: yes

### Phase 2: Real Captions Pipeline + Cost Protections
**Goal**: Replace the mock with a real captions-first extraction pipeline (GPT-4o `generateText + Output.object()` against the locked schema) gated by a hand-labeled eval set, shipped in the same release as the full cost-protection stack — so the first real OpenAI key is deployed only when rate limiting, cache, daily spend cap, OpenAI/Vercel budget caps, DMCA page, and daily smoke test are all live
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: EXTR-01, EXTR-02, EXTR-03, EXTR-04, COST-01, COST-02, COST-03, COST-04, ERRS-04, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. A user can paste a captioned YouTube workout URL and receive a real extracted workout (title, creator, exercises with sets/reps/rest, supersets, source quotes) within ~3–5 seconds end-to-end, rendered in the same UI built in Phase 1
  2. A `tests/eval/` set of 5–10 hand-labeled fitness videos plus 1 non-fitness control passes before the real-pipeline release ships; the control video extracts as "no workout detected" and blocks release if it produces a fabricated workout
  3. Repeat extractions of the same `videoId` return from the Upstash cache in under 1 second with no AI cost; abusive request patterns from a single IP are blocked by the `@upstash/ratelimit` sliding window with a friendly rate-limit UX (not a 429 dump); the global daily spend cap shows a "We're popular today — try again tomorrow" state when crossed
  4. Every extracted exercise carries a `sourceQuote` validated to appear in the transcript before being returned; low-confidence extractions surface a banner on the output ("results may be incomplete"); OpenAI dashboard budget cap and Vercel Spend Management cap are configured and visible in their respective dashboards
  5. A public DMCA / ToS / AI-disclaimer page is reachable from the footer, and a daily smoke test extracts a known-good YouTube video and alerts on failure (caption-API drift, LLM regression)
**Plans:** 6/7 plans executed
Plans:
- [x] 02-01-PLAN.md — Schema migration: add video_url: z.string().url().nullable() to WorkoutSchema + audit .optional() fields + backfill 5 fixtures + update ActionBar Watch-on-YouTube link (D-25)
- [x] 02-02-PLAN.md — Install 8 packages + Redis infrastructure: lib/redis/client.ts singleton + lib/ratelimit/index.ts (two-limiter pattern) + lib/spend/cap.ts (INCR/EXPIRE) + lib/cache/videoCache.ts (stampede lock)
- [x] 02-03-PLAN.md — Extraction pipeline building blocks: lib/youtube/captions.ts (primary+fallback) + lib/ai/extract.ts (generateText+Output.object) + lib/guards/sourceQuote.ts (hallucination guard)
- [x] 02-04-PLAN.md — Wire route.ts: all cost defenses in sequence + RealExtractionService stub replacement + BUDGET_EXHAUSTED SSE error code
- [x] 02-05-PLAN.md — UI affordances + ops: ConfidenceBanner + BUDGET_EXHAUSTED ErrorState + cached badge + /about page + smoke-test cron handler + vercel.json
- [x] 02-06-PLAN.md — Eval set: 9 fixture files + tests/eval/run.ts (pnpm eval) + human checkpoint for URL selection + binary pass gate
- [ ] 02-07-PLAN.md — Ship gate: 8-defense pre-flight audit + owner actions (OpenAI/Vercel dashboard caps) + EXTRACT_MODE=real flip + production smoke verify + STATE.md update

### Phase 3: Audio Fallback for Uncaptioned Videos
**Goal**: Close coverage on YouTube videos without captions by adding an audio-transcription fallback path — fetching audio off-Vercel (Supadata or Railway/Fly sidecar), transcribing with `gpt-4o-mini-transcribe`, then feeding the same LLM extraction step — protected by a pre-Whisper duration cap so the audio path can never blow up a single request
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EXTR-05, COST-05
**Success Criteria** (what must be TRUE):
  1. A user can paste an uncaptioned YouTube workout URL and receive an extracted workout via the audio-transcription fallback path, rendered in the same UI as the captions path, within ~25–60 seconds end-to-end
  2. Videos exceeding the configured duration cap (e.g., 30 min) are rejected before any audio fetch or Whisper call, with a friendly "video too long for the demo" error state
  3. The same cost-protection stack from Phase 2 (rate limit, cache, daily cap, budget caps) applies to the audio path; the daily smoke test extended to include one uncaptioned video alerts when the audio host or `gpt-4o-mini-transcribe` regresses
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Mock-Deployable Premium UI Demo | 5/5 | Complete | 2026-05-17 |
| 2. Real Captions Pipeline + Cost Protections | 6/7 | In Progress|  |
| 3. Audio Fallback for Uncaptioned Videos | 0/TBD | Not started | - |
