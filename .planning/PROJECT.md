# Exercised

## What This Is

A premium web app that converts social-media workout videos into structured, viewable workout routines. A user pastes a YouTube URL, an AI pipeline (yt-dlp → Whisper → LLM) parses the spoken/captioned content, and the app renders the workout as an interactive card list — exercise names, sets/reps, rest, form cues, and supersets — in a sleek dark-mode UI.

The web app is the first surface; a native mobile app is the long-term target. The web build is intentionally the fastest path to a shippable demo and a working ingestion pipeline.

## Core Value

**Paste a YouTube workout video URL → see a clean, structured, readable workout in seconds.** If extraction quality and the output UI feel premium, the product works. Everything else is supporting infrastructure.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until shipped. -->

- [ ] Landing page with prominent URL input + "Extract Workout" CTA
- [ ] Loading state that cycles through pipeline stages ("Fetching…" → "Transcribing…" → "Analyzing form cues…" → "Generating routine…")
- [ ] Workout output view: title, creator, estimated duration, target muscles as pill tags, scrollable exercise list
- [ ] Exercise cards: name, sets, reps, rest, expandable form cues
- [ ] Supersets visually grouped as a single bracketed card
- [ ] Mock `/api/extract` route returning fixture JSON after a 3s delay (unblocks UI work)
- [ ] Premium dark-mode aesthetic — glassmorphism cards, neon-green/electric-blue accents, Inter/Outfit typography, hover micro-animations
- [ ] Deployable to Vercel from day one
- [ ] Real AI extraction pipeline: yt-dlp metadata/audio → Whisper transcription → LLM (GPT-4o or Gemini) → typed JSON
- [ ] Error/empty-state UX when extraction fails or no workout content is detected
- [ ] Abuse protection on the real `/api/extract` (per-IP rate limit; real AI calls cost money and there's no auth wall)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **User accounts / auth** — v1 is anonymous. Save/library features are deferred until extraction quality is proven.
- **Active workout tracking (log sets, weights, rest timer)** — Out of v1. "Trackable" in v1 means *viewable as a structured routine*, not interactive logging. Mobile-app territory.
- **TikTok ingestion** — Deferred. Scraping is fragile and breaks when TikTok changes; revisit after YouTube proves out.
- **Instagram Reels ingestion** — Deferred. Auth-walled, requires cookies or a paid scraping API; not worth the cost in v1.
- **Native mobile app** — Future milestone. Web ships first; learnings inform mobile.
- **Saving / favoriting workouts** — Requires auth → deferred with the accounts decision.
- **Payments / subscriptions** — v1 is free demo. Monetization is a later conversation.
- **Multi-language transcripts** — English-only in v1. Whisper handles others, but the LLM prompt and form-cue extraction are tuned for English.

## Context

- **Greenfield project.** Empty directory, fresh git repo. No existing code, no design system, no constraints from prior work.
- **The brief is unusually specific.** The user provided a complete spec covering visual design (dark mode, glassmorphism, neon accents, Inter/Outfit), screen-by-screen UX, and the exact JSON contract for the extraction output. Treat that brief as locked design intent — don't drift from it without a reason.
- **AI pipeline assumed:** yt-dlp for video/audio fetch, OpenAI Whisper API for transcription, an LLM (GPT-4o or Gemini) for structuring. The data schema is the contract between mock and real backend.
- **Mock-first build strategy.** Phase 1 ships the full UI against a mocked `/api/extract` that returns fixture JSON after a delay. This decouples frontend polish from backend integration risk and gives us a deployable demo immediately.
- **YouTube-only in v1.** Cleanest yt-dlp path, frequently has public captions (which can shortcut Whisper entirely on captioned videos and cut cost/latency dramatically).
- **No backend abuse protection today.** Once real AI calls land, anonymous users hitting Whisper + LLM = real dollars per request. Rate limiting is a v1 must-have, not a polish task.

## Constraints

- **Tech stack**: Next.js (App Router) + TypeScript + Tailwind CSS, deployed to Vercel — confirmed by user. Component library will be shadcn/ui unless contradicted during UI phase.
- **Timeline**: "As fast as possible." Treat time-to-shippable-demo as the primary axis. Prefer fewer phases, broader slices, mock-first builds.
- **Budget**: Implied lean. Real AI calls cost real money — design the extraction pipeline to short-circuit (e.g., use YouTube captions when available before reaching for Whisper).
- **Dependencies**: yt-dlp must run somewhere with the right binary (Vercel functions can be tight on cold start / binary size — may need to evaluate Vercel functions vs. a small worker / Fly / Cloudflare during the AI integration phase).
- **Design fidelity**: The premium aesthetic is part of the value proposition, not paint. UI quality bar is high — glassmorphism, motion, type choices are non-negotiable.
- **Scope discipline**: No auth, no DB, no tracker in v1. Every "what if we also…" answer is "out of scope" until extraction quality is validated.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web first, mobile later | Fastest path to a usable, shippable product; web learnings inform mobile | — Pending |
| Next.js + Vercel | API route + SSR + edge deploy in one stack; matches `/api/extract` pattern in brief | — Pending |
| YouTube only in v1 | Cleanest ingestion path; TikTok/Instagram scraping is fragile and adds risk | — Pending |
| v1 is anonymous (no accounts) | Auth is the largest scope multiplier; defer until extraction is proven valuable | — Pending |
| Mock `/api/extract` ships before real pipeline | Decouples UI build from AI integration; gives a deployable demo from Phase 1 | — Pending |
| JSON schema is the mock/real contract | Frontend can be built and signed off against fixtures; backend just needs to produce the same shape | — Pending |
| Lock the design brief (dark, glassmorphism, neon accents, Inter/Outfit) | Premium aesthetic is part of core value, not a polish layer | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 after initialization*
