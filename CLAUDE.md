<!-- GSD:project-start source:PROJECT.md -->
## Project

**Exercised**

A premium web app that converts social-media workout videos into structured, viewable workout routines. A user pastes a YouTube URL, an AI pipeline (yt-dlp → Whisper → LLM) parses the spoken/captioned content, and the app renders the workout as an interactive card list — exercise names, sets/reps, rest, form cues, and supersets — in a sleek dark-mode UI.

The web app is the first surface; a native mobile app is the long-term target. The web build is intentionally the fastest path to a shippable demo and a working ingestion pipeline.

**Core Value:** **Paste a YouTube workout video URL → see a clean, structured, readable workout in seconds.** If extraction quality and the output UI feel premium, the product works. Everything else is supporting infrastructure.

### Constraints

- **Tech stack**: Next.js (App Router) + TypeScript + Tailwind CSS, deployed to Vercel — confirmed by user. Component library will be shadcn/ui unless contradicted during UI phase.
- **Timeline**: "As fast as possible." Treat time-to-shippable-demo as the primary axis. Prefer fewer phases, broader slices, mock-first builds.
- **Budget**: Implied lean. Real AI calls cost real money — design the extraction pipeline to short-circuit (e.g., use YouTube captions when available before reaching for Whisper).
- **Dependencies**: yt-dlp must run somewhere with the right binary (Vercel functions can be tight on cold start / binary size — may need to evaluate Vercel functions vs. a small worker / Fly / Cloudflare during the AI integration phase).
- **Design fidelity**: The premium aesthetic is part of the value proposition, not paint. UI quality bar is high — glassmorphism, motion, type choices are non-negotiable.
- **Scope discipline**: No auth, no DB, no tracker in v1. Every "what if we also…" answer is "out of scope" until extraction quality is validated.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Headline Recommendation
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.2.x | Web framework + API routes | Locked by brief. App Router + Server Components + Route Handlers is the 2026 default for AI apps; first-class streaming, partial prerendering, and tight integration with the Vercel AI SDK. |
| TypeScript | 5.6+ | Type safety end-to-end | Locked by brief. Required for Zod-typed LLM outputs to be useful in the UI. |
| Tailwind CSS | 4.3.x | Styling | Locked by brief. v4 ships native CSS-variable theming, which is what shadcn/ui v3 now targets — pairs cleanly with glassmorphism (backdrop-blur, semi-transparent layers, neon ring accents). |
| shadcn/ui | latest (CLI-installed components, not a versioned package) | Component primitives | Confirm. It's not a dependency — it's source you copy in via the CLI. Gives you Radix-based, accessible primitives in your own repo that you restyle for glassmorphism. No vendor lock-in, no theme fights. |
| next-themes | 0.4.x | Dark mode toggle / class strategy | Two-line dark-mode in Next.js App Router. Standard companion to shadcn/ui. We default to dark and don't need a toggle for v1, but include it so a future light mode is one prop away. |
| Vercel AI SDK | `ai@6.0.x` + `@ai-sdk/openai@3.0.x` (and/or `@ai-sdk/google@3.0.x`) | LLM orchestration | The cleanest path for one-shot structured extraction with Zod schemas. `generateObject({ schema, model, prompt })` validates the JSON against your Zod schema, retries on parse failure, and the same call works against OpenAI or Gemini by swapping one line. No reason to drop to the raw OpenAI SDK for our use case; no reason to bring LangChain into a one-shot extractor. |
| OpenAI Node SDK | `openai@6.x` | Whisper transcription only | We use this for the audio→text call (Whisper / `gpt-4o-mini-transcribe`), because the AI SDK's text-generation primitives don't cover transcription. Two SDKs is fine — they serve different parts of the pipeline. |
| Zod | 4.4.x | Schema for the workout JSON | The contract between mock `/api/extract`, real `/api/extract`, and the UI. Same schema is used to: (a) constrain the LLM output via `generateObject`, (b) validate API responses on the client, (c) generate TypeScript types for the UI. One source of truth. |
| Upstash Redis + `@upstash/ratelimit` | `@upstash/redis@1.38.x` + `@upstash/ratelimit@2.0.x` | Per-IP rate limit on `/api/extract` | Serverless-native (HTTP-based, works on Edge runtime, no connection pool drama). Sliding-window algorithm is one import + 4 lines. Free tier covers v1 traffic by an order of magnitude. |
| Motion (formerly Framer Motion) | `motion@12.38.x` | Loading-stage transitions, card hover micro-animations, supersets bracket reveal | The brief's "smooth micro-animations" + "cycles through pipeline stages" is exactly Motion's sweet spot. Layout animations and `AnimatePresence` for the loading-stage cycle are not realistic to hand-roll in CSS for a polish-grade demo. |
| Geist (or Inter) | `geist@1.x` (npm) for Geist; `next/font/google` for Inter/Outfit | Typography | See "Font Choice" below — recommend Geist for the headline UI font and Geist Mono for set/rep numeric, which delivers the brief's "premium" feel with zero font-loading config. |
### Ingestion Sidecar (separate service)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js + Fastify (or Express) | Node 22 LTS | Tiny HTTP wrapper around yt-dlp | Long-lived process, persistent disk, no cold-start audio drops. ~50 LOC of glue. |
| yt-dlp | install via `pip install yt-dlp` in the container; pin to a recent release | Audio fetch | Brief-locked. Must run in a long-lived container, not a serverless function (see "What NOT to Use"). |
| ffmpeg | system package in the container | Audio re-encode to 16kHz mono MP3 for Whisper | Cuts Whisper input size 5–10×, which materially reduces cost. yt-dlp itself depends on ffmpeg for merging/conversion. |
| Hosting: Railway | n/a | Always-on container | $5/mo starter, persistent process, no 250 MB function ceiling, no datacenter-IP heuristics specific to Vercel. Fly.io is an equally valid alternative; pick whichever you already have an account on. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `youtube-caption-extractor` | 1.10.x | Pull captions directly from YouTube when they exist | First step of `/api/extract`. If captions are present, skip yt-dlp + Whisper entirely. Cuts cost-per-extraction from ~$0.01–0.03 (audio path) to ~$0.001 (LLM-only path) and cuts latency by 10–30s. |
| `youtube-transcript` | 1.3.x | Fallback caption extractor | Only if `youtube-caption-extractor` fails; both libraries hit unofficial YouTube endpoints and one will sometimes work when the other doesn't. Wrap both behind a single `getCaptions(videoId)` function. |
| `lucide-react` | latest | Icon set | shadcn/ui's default icons; covers everything we need (play, refresh, link, copy, dumbbell, timer). |
| `clsx` + `tailwind-merge` (or `cn` helper from shadcn) | latest | Class merging | Standard shadcn/ui boilerplate — needed for the variant pattern on Button/Card. |
| `@vercel/analytics` (optional) | latest | Real-user analytics | Free with Vercel; useful for seeing whether anonymous users actually hit `/api/extract`. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Faster installs, deterministic lockfile, better monorepo support if/when we add the sidecar to the same repo. Vercel supports it natively. |
| ESLint + `eslint-config-next` | Linting | Bundled with `create-next-app`. |
| Prettier + `prettier-plugin-tailwindcss` | Formatting | Sorts Tailwind classes to a canonical order — non-negotiable when class strings get long with glassmorphism utilities. |
| Vitest | Unit tests | Faster than Jest, native ESM, works with TypeScript out of the box. Used for: (a) Zod schema round-trip tests against fixture JSON, (b) `getCaptions` adapter tests. |
## Installation
# Bootstrap
# shadcn/ui (initializes itself, asks for theme/colors)
# Core runtime
# Dev
# Sidecar (separate repo / separate Railway service) — Dockerfile, not npm:
# FROM node:22-slim
# RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
#     pip3 install --break-system-packages yt-dlp
# ...
## The Five Questions, Answered
### 1. Component library — **shadcn/ui, confirmed**
### 2. Animation library — **Motion (the rebranded Framer Motion)**
- The loading-stage cycle ("Fetching…" → "Transcribing…" → "Analyzing…" → "Generating…") wants `AnimatePresence` for clean enter/exit; that's a 5-line Motion component vs. ~40 lines of CSS keyframes + state machine.
- Card hover micro-animations (lift, glow, scale) are one `whileHover={{ y: -4, scale: 1.02 }}` prop.
- Supersets visually grouped as a bracketed card wants a `layoutId` shared-element transition when expanding; that's Motion's killer feature.
### 3. Fonts — **Geist for v1 (don't ship Inter+Outfit pairing)**
- Single `npm i geist` import — zero `next/font/google` config, zero FOIT, deploys instantly.
- Geist is "Inter with a polish" — same neutral geometric feel, slightly friendlier curves, designed specifically for dark-mode UI.
- Geist Mono is purpose-built for numeric tabular data — perfect for `3 × 12 @ 60s rest` strings on exercise cards (tabular nums, no jitter when sets/reps update).
### 4. AI SDK — **Vercel AI SDK (`ai@6`), not raw OpenAI SDK, not LangChain**
### 5. Structured output — **OpenAI Structured Outputs via Zod, with Gemini as backup**
- OpenAI's Structured Outputs mode (introduced 2024) gives a *grammar-level guarantee* that the response will validate against the supplied schema. The AI SDK plumbs this through automatically when you pass a Zod schema to `generateObject`.
- GPT-4o is consistently the most reliable model for first-call schema conformance in published benchmarks; Gemini 2.5 Pro is comparable, Gemini 2.5 Flash is roughly 8% more error-prone on complex multi-step structured outputs.
- Cost: GPT-4o is $2.50/M input, $10/M output. A typical workout transcript is 2,000–6,000 input tokens and ~500–1,500 output tokens — call it **$0.01–0.03 per extraction**.
### 6. yt-dlp on Vercel — **No. Run it on Railway/Fly.io as a sidecar.**
- **Railway** — recommended. $5/mo, deploy from a Dockerfile, persistent container, easy logs. Best DX-to-cost ratio for this use case.
- **Fly.io** — same shape, slightly cheaper at idle, slightly more ops complexity. Pick this if you already have a Fly account.
- **Render background worker** — works fine, slower deploys, less developer-friendly logging.
- **Cloudflare Workers** — **does not work.** No subprocess execution, no Python runtime, no ffmpeg.
- **Third-party API (Apify, RapidAPI YouTube downloaders)** — works, but $0.05–$0.20 per download adds up fast and you're paying someone else to take the YouTube-blocking risk. Use this only if the Railway sidecar becomes the hot spot and you want to outsource the cat-and-mouse game with YouTube.
### 7. YouTube captions — **Yes, skip Whisper entirely when captions exist**
- **Caption path:** ~1s, ~$0.01–0.03 (LLM only).
- **Whisper path:** ~10–30s (download + transcribe), ~$0.02–0.05 (Whisper $0.006/min audio + LLM).
### 8. Rate limiting — **Upstash Redis + `@upstash/ratelimit`, sliding window, 5 requests / 1 hour / IP**
- **HTTP-based Redis** — works on any Vercel runtime, no connection pool issues.
- **Sliding window** — avoids the burst-at-boundary problem of fixed window.
- **5/hour/IP** — calibrated to "a curious user can try a handful of videos without hitting the wall; a scraper or abuser is stopped within minutes". Re-tune based on observed traffic post-launch.
- **Free tier** covers ~10k requests/day, vastly more than v1 needs.
- In-memory counters (`Map`) — Vercel functions are stateless and ephemeral; counters reset on every cold start. Useless against any real abuse.
- `@vercel/edge-config` — read-mostly KV store, not designed for atomic increments. Wrong tool.
- Vercel WAF / firewall rate limits — too coarse for our use case (you want per-IP semantic limits on `/api/extract` specifically).
### 9. Hosting — **Vercel for `web`, Railway for `ingest` sidecar**
- Next.js hosting (free Hobby tier is plenty for v1)
- The `/api/extract` route handler (Fluid Compute, 300s timeout on Hobby — Whisper of a 10-min video typically completes in 30–60s)
- Edge caching of static assets
- Preview deployments per branch (huge for demoing iterations)
- yt-dlp + ffmpeg in a persistent container ($5/mo starter)
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vercel AI SDK | Raw OpenAI SDK | If you specifically need OpenAI features the AI SDK doesn't expose (e.g., the Realtime API). Not our use case. |
| Vercel AI SDK | LangChain.js / LlamaIndex | If the pipeline grows multi-step (RAG over a workout library, agent that searches the web for form cues). v1 is one-shot — no. |
| Motion | Native CSS animations | If bundle size becomes critical *and* the design simplifies to 1–2 hover states. We have a multi-stage loading cycle and shared-element supersets transition — Motion earns its keep. |
| Motion | Motion One | If we ship to a mobile-first audience on very low-end devices. v1 is desktop-first; Motion's DX wins. |
| Geist | Inter + Outfit pairing | If the user has a strong preference (the brief leaves it open). Pairing is fine; just slightly more loading config. |
| GPT-4o | Gemini 2.5 Flash | If per-call cost becomes the binding constraint. Make the model swappable so you can A/B test in 1 line. |
| GPT-4o | GPT-4o-mini | For the LLM extractor in v2 if quality holds up — ~10× cheaper. Worth A/B testing once we have a real eval set. |
| Whisper (`whisper-1`) | `gpt-4o-mini-transcribe` | Same price ($0.006/min on the full model, $0.003/min on mini), better word-error rate. Use `gpt-4o-mini-transcribe` for v1 — it's cheaper and more accurate. The only thing Whisper-1 gives you that gpt-4o-transcribe does not is word-level timestamps, which we don't need. |
| Railway (sidecar) | Fly.io | Equivalent for our needs; pick by personal preference / existing account. |
| Railway (sidecar) | Apify or RapidAPI YouTube API | If yt-dlp breakage becomes a maintenance burden, outsource it. Costs more per call, removes the failure mode. |
| Upstash sliding window | Vercel WAF rate-limit rules | For coarse global limits in front of Vercel WAF (e.g., 100 req/min/IP for *all* routes). Use *in addition to* Upstash, not instead. |
| shadcn/ui | Tailwind UI (paid) | Never — shadcn/ui matches or exceeds Tailwind UI's quality and gives you source-level ownership. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| yt-dlp inside a Vercel function | Function size limit, cold start, and (decisively) YouTube's datacenter-IP / PoToken blocking in 2025 — extractions will fail intermittently in ways that are impossible to debug from logs | Railway/Fly sidecar |
| Cloudflare Workers for the ingest sidecar | No subprocess execution, no Python, no ffmpeg. yt-dlp cannot run there at all | Railway/Fly |
| LangChain.js | Heavy dependency surface, slow release cadence, designed for chains/agents not one-shot extraction | Vercel AI SDK (`generateObject`) |
| Prompt-engineered "respond in JSON" without Structured Outputs | ~3–8% malformed JSON rate even with strong prompts; we already have schema-enforced outputs available | Zod schema + `generateObject` → OpenAI Structured Outputs mode |
| In-memory rate limit (Map / object) on Vercel | Functions are stateless; counters reset between invocations; provides zero abuse protection | Upstash Redis + `@upstash/ratelimit` |
| `@vercel/edge-config` for rate limiting | Read-mostly KV; not built for atomic counters | Upstash Redis |
| MUI / Chakra / Mantine | Fights Tailwind, runtime overhead, dated visual defaults vs. the brief's premium aesthetic | shadcn/ui |
| GSAP for our scope | Overkill for ~6 animated elements; commercial license needs care | Motion |
| Self-hosted .woff2 fonts in `/public` | Misses `next/font` preloading, subsetting, and CLS prevention | `next/font/google` or the `geist` npm package |
| `whisper-1` (legacy Whisper) | `gpt-4o-mini-transcribe` is cheaper *and* more accurate; only reason to prefer Whisper is word-level timestamps | `gpt-4o-mini-transcribe` |
| Edge runtime for `/api/extract` | Edge has 25s soft / 30s hard request limits and a smaller standard library; no benefit for our slow LLM call | Node.js runtime + Fluid Compute (300s) |
| Building a TikTok / Instagram ingestor in v1 | Out of scope per PROJECT.md; scraping is fragile, breaks under TikTok updates, often auth-walled on Instagram | Defer per project decision |
## Stack Patterns by Variant
- Skip yt-dlp and Whisper entirely
- Pipeline: `YouTube URL → getCaptions() → LLM (GPT-4o + Zod) → UI`
- Latency: ~1–3s end-to-end. Cost: ~$0.01–0.03 per extraction.
- Pipeline: `YouTube URL → Railway sidecar (yt-dlp → ffmpeg → MP3) → OpenAI gpt-4o-mini-transcribe → LLM (GPT-4o + Zod) → UI`
- Latency: ~10–30s end-to-end. Cost: ~$0.02–0.05 per extraction.
- Add a quality heuristic on the LLM output. If the workout has <2 exercises or every exercise has identical sets/reps, retry on the Whisper path. Treat caption path as "fast preview, Whisper path as authoritative".
- Swap the LLM model from `gpt-4o` to `gpt-4o-mini` or `gemini-2.5-flash` (one-line change in the AI SDK call). Re-validate quality with a fixture set.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.x` | `react@19.x`, `tailwindcss@4.x`, `motion@12.x` | All current 2026 defaults. Next 16 ships with React 19. |
| `ai@6.x` | `zod@4.x`, `@ai-sdk/openai@3.x`, `@ai-sdk/google@3.x` | AI SDK 5+ added Zod 4 support. Don't mix `ai@5.x` with Zod 4 — there were known issues during the transition. |
| `tailwindcss@4.x` | `shadcn/ui` (latest CLI) | shadcn's recent versions target Tailwind 4's CSS-variable theme model. If you initialized with Tailwind 3, you'll need to upgrade. |
| `motion@12.x` | `react@19.x` | Drop-in replacement for `framer-motion@11`; same imports, same API surface. |
| `@upstash/ratelimit@2.x` | `@upstash/redis@1.38+` | Both required; pin together. |
| `geist@1.x` | `next@13+` | Single import, no `next/font` config needed. |
## Cost Implications (Per Extraction)
| Stage | Caption Path | Whisper Path |
|-------|--------------|--------------|
| Caption fetch | $0 | $0 |
| yt-dlp + ffmpeg (Railway) | $0 | ~$0 amortized over $5/mo container |
| Transcription (`gpt-4o-mini-transcribe`) | $0 | ~$0.015–0.045 for a 5–15 min video |
| LLM extraction (GPT-4o, ~3k in / ~1k out) | ~$0.018 | ~$0.018 |
| Rate-limit lookup (Upstash) | <$0.0001 | <$0.0001 |
| **Total per extraction** | **~$0.02** | **~$0.03–0.06** |
| If LLM = Gemini 2.5 Flash | ~$0.001 | ~$0.016–0.046 |
## Sources
- [Vercel AI SDK docs — generateObject + Zod](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — HIGH confidence; verified primitive name, Zod 4 support, retry semantics
- [Vercel AI SDK 5 release post](https://vercel.com/blog/ai-sdk-5) — HIGH; confirmed v5+ shipped 2025, current is `ai@6.x` per npm
- [npm: `ai`, `motion`, `@upstash/ratelimit`, `@ai-sdk/openai`, `@ai-sdk/google`, `geist`, `youtube-caption-extractor`](https://www.npmjs.com/) — HIGH; pulled current versions live during research (`ai@6.0.184`, `motion@12.38.0`, etc.)
- [OpenAI API pricing](https://openai.com/api/pricing/) — HIGH; GPT-4o at $2.50/$10 per M tokens, Whisper at $0.006/min, gpt-4o-mini-transcribe at $0.003/min
- [Artificial Analysis WER benchmark — GPT-4o-transcribe vs Whisper](https://x.com/ArtificialAnlys/status/1902907556118532399) — MEDIUM; third-party benchmark, but consistent with multiple corroborating sources
- [yt-dlp issue #15800 — "Sign in to confirm you're not a bot"](https://github.com/yt-dlp/yt-dlp/issues/15800) — HIGH; direct evidence of YouTube's datacenter-IP blocking in 2025
- [HN: YouTube cracking down on yt-dlp](https://news.ycombinator.com/item?id=43398222) — MEDIUM; corroborates the broader pattern
- [Vercel docs — Fluid Compute and function duration](https://vercel.com/docs/functions/configuring-functions/duration) — HIGH; confirmed Hobby 300s, Pro 300s default / 800s max
- [Vercel runtimes — function size limit 250 MB](https://vercel.com/docs/functions/runtimes) — HIGH
- [Vercel changelog — fluid compute defaults](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) — HIGH
- [shadcn/ui dark mode docs](https://ui.shadcn.com/docs/dark-mode/next) — HIGH; confirmed `next-themes` integration
- [shadcn-glass-ui — DEV community](https://dev.to/yhooi2/introducing-shadcn-glass-ui-a-glassmorphism-component-library-for-react-4cpl) — MEDIUM; community add-on, useful as reference for glassmorphism patterns on top of shadcn
- [Motion (framer-motion successor) docs](https://motion.dev/) — HIGH; confirmed Motion is the rebranded/current package
- [Upstash ratelimit docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — HIGH; sliding-window API, Edge-compatible, free-tier limits
- [OpenAI Structured Outputs announcement](https://openai.com/api/pricing/) — HIGH; grammar-level schema conformance guarantee
- [Gemini 2.5 Flash vs GPT-4o cost comparison](https://blog.galaxy.ai/compare/gemini-2-5-flash-vs-gpt-4o) — MEDIUM; pricing matches Google's own pricing page; benchmark numbers are third-party
- [Apify YouTube downloader actors](https://apify.com/streamers/youtube-video-downloader/api) — MEDIUM; confirmed third-party fallback option exists
- [Yozora — yt-dlp on Vercel proof-of-concept](https://github.com/ectora/yozora) — MEDIUM; confirms it's *possible* in narrow cases but does not contradict the broader unreliability finding
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
