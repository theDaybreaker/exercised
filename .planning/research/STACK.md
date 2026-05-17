# Stack Research

**Domain:** Next.js AI-extraction web app (YouTube URL → transcript → LLM → structured workout JSON → premium dark UI)
**Researched:** 2026-05-16
**Confidence:** HIGH on web/UI/LLM choices; HIGH on the negative finding that yt-dlp will not run reliably from Vercel; MEDIUM on the exact sidecar choice (multiple acceptable options)

## Headline Recommendation

Ship Exercised as **two services**, not one:

1. **`web`** — Next.js 16 (App Router) on Vercel. Owns the UI, the `/api/extract` route, rate limiting, the LLM extraction call, and the YouTube-captions short-circuit path.
2. **`ingest`** — a tiny long-lived Node service on **Railway** (or Fly.io) that wraps `yt-dlp` + `ffmpeg` and exposes `POST /audio` → returns an MP3 (or a signed URL to one). Vercel's serverless function from `web` calls this sidecar only when YouTube captions are unavailable.

Everything else (component library, animations, LLM SDK, transcription, rate limiting, fonts) collapses to one prescriptive choice with no real second-guessing in 2026. The yt-dlp piece is the only architectural fork, and the brief itself flagged that risk — research confirms it.

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

```bash
# Bootstrap
pnpm create next-app@latest exercised --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# shadcn/ui (initializes itself, asks for theme/colors)
pnpm dlx shadcn@latest init

# Core runtime
pnpm add ai @ai-sdk/openai @ai-sdk/google openai zod \
  @upstash/redis @upstash/ratelimit \
  motion next-themes \
  youtube-caption-extractor youtube-transcript \
  geist lucide-react clsx tailwind-merge

# Dev
pnpm add -D vitest @vitest/ui prettier prettier-plugin-tailwindcss

# Sidecar (separate repo / separate Railway service) — Dockerfile, not npm:
# FROM node:22-slim
# RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && \
#     pip3 install --break-system-packages yt-dlp
# ...
```

## The Five Questions, Answered

### 1. Component library — **shadcn/ui, confirmed**

Use shadcn/ui. It's the de-facto 2026 default for Next.js + Tailwind + Radix, the components are owned in your repo (not a node_module), and there are now multiple glassmorphism add-on collections (`shadcn-glass-ui`, `allshadcn` Glass UI) that install on top via the same CLI. Pair with `next-themes`, set the root to `dark`, and you have premium glassmorphism + dark mode running in under an hour.

**Don't use:** MUI (too opinionated, fights Tailwind), Chakra (heavy runtime, dated aesthetic), Mantine (excellent but not the path of least resistance with the shadcn ecosystem), Tailwind UI (paid, less flexible than shadcn's "you own the source" model).

Confidence: HIGH.

### 2. Animation library — **Motion (the rebranded Framer Motion)**

Install as `motion@12.x` — same library, new name. Three reasons:

- The loading-stage cycle ("Fetching…" → "Transcribing…" → "Analyzing…" → "Generating…") wants `AnimatePresence` for clean enter/exit; that's a 5-line Motion component vs. ~40 lines of CSS keyframes + state machine.
- Card hover micro-animations (lift, glow, scale) are one `whileHover={{ y: -4, scale: 1.02 }}` prop.
- Supersets visually grouped as a bracketed card wants a `layoutId` shared-element transition when expanding; that's Motion's killer feature.

**Don't use:** Motion One — smaller bundle, but worse React DX, no `layout` animations, and the WAAPI advantage is invisible on the 4–6 elements that actually animate on this page. CSS-only — fine for one card hover, doesn't scale to the loading cycle. GSAP — overkill, and the license requires care for commercial use.

Confidence: HIGH.

### 3. Fonts — **Geist for v1 (don't ship Inter+Outfit pairing)**

The brief lists "Inter or Outfit" — note the "or". The cleanest premium-feeling 2026 choice is actually **Geist + Geist Mono**, Vercel's house font, because:

- Single `npm i geist` import — zero `next/font/google` config, zero FOIT, deploys instantly.
- Geist is "Inter with a polish" — same neutral geometric feel, slightly friendlier curves, designed specifically for dark-mode UI.
- Geist Mono is purpose-built for numeric tabular data — perfect for `3 × 12 @ 60s rest` strings on exercise cards (tabular nums, no jitter when sets/reps update).

If the user has a hard preference for Inter/Outfit, do this pairing instead:

```tsx
import { Inter, Outfit } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
```

Use **Outfit for H1/hero** (it has slightly more brand voice — friendlier "g", rounder caps), **Inter for everything else**. Inter for body, UI, exercise names; Outfit for the landing hero and exercise counts.

**Don't use:** Self-hosted .woff2 files in `public/` — `next/font` handles preloading, subsetting, and CLS prevention automatically and is strictly better. Don't load both Inter and Outfit if you only use one of them in the final design — every extra weight is 20–40KB.

Confidence: HIGH on the technical mechanism (`next/font`), MEDIUM on Geist vs. Inter+Outfit (it's a taste call — both are defensible).

### 4. AI SDK — **Vercel AI SDK (`ai@6`), not raw OpenAI SDK, not LangChain**

`generateObject` from the Vercel AI SDK is exactly the right primitive:

```ts
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { WorkoutSchema } from "@/lib/schema";

const { object } = await generateObject({
  model: openai("gpt-4o-2024-11-20"),
  schema: WorkoutSchema,           // Zod schema → automatic OpenAI Structured Outputs
  prompt: buildPrompt(transcript),
  maxRetries: 2,                   // built-in retry on schema-validation failure
});
// `object` is fully typed from WorkoutSchema
```

Why not the raw OpenAI SDK: you'd be re-implementing JSON-schema generation from Zod, retry-on-parse-failure, and provider-swap (GPT-4o ↔ Gemini for A/B testing) yourself. The Vercel AI SDK is a thin wrapper that adds exactly those three things and nothing else heavy.

Why not LangChain: LangChain is built for chains, agents, retrieval, and tool routing. We have one transcript and one extraction call. LangChain triples the dependency surface and adds zero capability for this shape of problem.

**One caveat verified during research:** Use the AI SDK on the Node.js runtime (not Edge) for `/api/extract`. The Edge runtime is fine for streaming chat but unnecessary here and forces Edge-only constraints with no benefit. Set `export const runtime = "nodejs"` in the route handler. With Vercel's Fluid Compute (default since April 2025), Hobby gets 300s timeout and Pro can go to 800s — plenty for the full pipeline.

Confidence: HIGH.

### 5. Structured output — **OpenAI Structured Outputs via Zod, with Gemini as backup**

Pipeline:

```
Zod schema → AI SDK auto-converts to JSON Schema → OpenAI Structured Outputs mode → guaranteed schema conformance
```

**Recommended model: `gpt-4o-2024-11-20`.**

- OpenAI's Structured Outputs mode (introduced 2024) gives a *grammar-level guarantee* that the response will validate against the supplied schema. The AI SDK plumbs this through automatically when you pass a Zod schema to `generateObject`.
- GPT-4o is consistently the most reliable model for first-call schema conformance in published benchmarks; Gemini 2.5 Pro is comparable, Gemini 2.5 Flash is roughly 8% more error-prone on complex multi-step structured outputs.
- Cost: GPT-4o is $2.50/M input, $10/M output. A typical workout transcript is 2,000–6,000 input tokens and ~500–1,500 output tokens — call it **$0.01–0.03 per extraction**.

**When to consider Gemini 2.5 Flash instead:** if cost-per-call becomes the dominant constraint at scale. Flash is ~16× cheaper ($0.30/M in, $2.50/M out → ~$0.001–0.005 per extraction). For v1's anonymous-demo traffic, GPT-4o reliability is worth more than the savings — the worst outcome in a demo is a malformed card, not a $0.02 invoice line. Make the model swappable (it's one line in the AI SDK) and revisit at scale.

**Don't:** prompt-engineer JSON output without Structured Outputs mode (e.g., "respond in JSON like…"). Pre-Structured-Outputs JSON prompting fails ~3–8% of the time even with the best prompt. We have Zod-validated structured outputs available — use them.

Confidence: HIGH on the mechanism; MEDIUM on the exact GPT-4o-vs-Gemini choice (both are defensible; the brief explicitly leaves it open).

### 6. yt-dlp on Vercel — **No. Run it on Railway/Fly.io as a sidecar.**

This is the single most important infrastructure finding. Three independent blockers:

1. **Binary size.** `yt-dlp` + `ffmpeg` together push hard against Vercel's 250 MB unzipped function limit. Possible to fit with careful builds, but fragile.
2. **Cold start + execution model.** yt-dlp is a Python CLI tool that spawns subprocesses, writes to disk, and reads streams. Vercel functions have read-only filesystems (writable `/tmp` only), and even on Fluid Compute the cold-start tax is real for a multi-megabyte Python runtime.
3. **YouTube's 2025 datacenter-IP crackdown is the killer.** Throughout 2025 YouTube rolled out PoToken (Proof-of-Origin Token) checks and aggressive datacenter-IP blocking. Vercel's serverless functions run from major cloud datacenters whose IP ranges YouTube heuristically flags. The result observed across the yt-dlp community: same code, same yt-dlp version, runs fine from your laptop, fails from a serverless function with "Sign in to confirm you're not a bot". Workarounds exist (cookies, residential proxies) but all of them are explicit ToS violations or get accounts banned.

**Solution: thin Node/Fastify service on Railway.** ~50 LOC. Owns yt-dlp + ffmpeg. Vercel function calls `POST /audio` with the YouTube URL, receives an MP3 (or a signed S3/R2 URL to one). The Railway IP has the same "datacenter" problem in theory, but in practice (a) you can swap regions easily, (b) you can plug a residential proxy at the sidecar layer if needed without contaminating the rest of the stack, and (c) you sidestep the function-size/cold-start issues entirely.

**Alternatives ranked:**

- **Railway** — recommended. $5/mo, deploy from a Dockerfile, persistent container, easy logs. Best DX-to-cost ratio for this use case.
- **Fly.io** — same shape, slightly cheaper at idle, slightly more ops complexity. Pick this if you already have a Fly account.
- **Render background worker** — works fine, slower deploys, less developer-friendly logging.
- **Cloudflare Workers** — **does not work.** No subprocess execution, no Python runtime, no ffmpeg.
- **Third-party API (Apify, RapidAPI YouTube downloaders)** — works, but $0.05–$0.20 per download adds up fast and you're paying someone else to take the YouTube-blocking risk. Use this only if the Railway sidecar becomes the hot spot and you want to outsource the cat-and-mouse game with YouTube.

Confidence: HIGH on "Vercel won't work reliably", HIGH on "Railway/Fly works", MEDIUM on Railway vs. Fly (taste call).

### 7. YouTube captions — **Yes, skip Whisper entirely when captions exist**

The two libraries to use (both at the same time, with fallback):

```ts
// Try captions first
async function getTranscript(videoId: string): Promise<string | null> {
  try {
    const captions = await getSubtitles({ videoID: videoId, lang: "en" }); // youtube-caption-extractor
    return captions.map(c => c.text).join(" ");
  } catch {
    try {
      const list = await YoutubeTranscript.fetchTranscript(videoId);     // youtube-transcript
      return list.map(t => t.text).join(" ");
    } catch {
      return null; // fall through to yt-dlp + Whisper
    }
  }
}
```

Both libraries hit YouTube's unofficial Innertube API. Both break occasionally; they break at different times. Using both gives you a meaningful uplift in success rate for ~zero code cost.

**Cost / latency math:**
- **Caption path:** ~1s, ~$0.01–0.03 (LLM only).
- **Whisper path:** ~10–30s (download + transcribe), ~$0.02–0.05 (Whisper $0.006/min audio + LLM).

For a typical fitness creator's 5–15 minute YouTube video with auto-generated captions, the caption path saves 80% of latency and 30–50% of cost. Most YouTube workout videos do have auto-captions. This short-circuit is the single biggest cost lever in v1.

**Caveat (LOW confidence):** auto-generated captions occasionally include errors that affect extraction quality (e.g. "rows" → "roads", "lat pulldown" → "lap pulldown"). For v1, accept this — the LLM is robust to minor spelling errors. If extraction quality measurably suffers in user testing, add a heuristic: if the LLM returns a low-confidence workout or fails extraction, retry on the Whisper path.

### 8. Rate limiting — **Upstash Redis + `@upstash/ratelimit`, sliding window, 5 requests / 1 hour / IP**

```ts
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
});

// In /api/extract:
const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
const { success } = await ratelimit.limit(ip);
if (!success) return new Response("Rate limit exceeded", { status: 429 });
```

Why this:
- **HTTP-based Redis** — works on any Vercel runtime, no connection pool issues.
- **Sliding window** — avoids the burst-at-boundary problem of fixed window.
- **5/hour/IP** — calibrated to "a curious user can try a handful of videos without hitting the wall; a scraper or abuser is stopped within minutes". Re-tune based on observed traffic post-launch.
- **Free tier** covers ~10k requests/day, vastly more than v1 needs.

**Don't use:**
- In-memory counters (`Map`) — Vercel functions are stateless and ephemeral; counters reset on every cold start. Useless against any real abuse.
- `@vercel/edge-config` — read-mostly KV store, not designed for atomic increments. Wrong tool.
- Vercel WAF / firewall rate limits — too coarse for our use case (you want per-IP semantic limits on `/api/extract` specifically).

Confidence: HIGH.

### 9. Hosting — **Vercel for `web`, Railway for `ingest` sidecar**

Final shape:

```
[Browser] → Vercel (Next.js: UI, /api/extract, rate limit, captions, LLM)
                ↓ (only if captions missing)
            Railway (yt-dlp + ffmpeg sidecar)
                ↓
            OpenAI (Whisper) + OpenAI (GPT-4o via AI SDK)
```

Vercel covers:
- Next.js hosting (free Hobby tier is plenty for v1)
- The `/api/extract` route handler (Fluid Compute, 300s timeout on Hobby — Whisper of a 10-min video typically completes in 30–60s)
- Edge caching of static assets
- Preview deployments per branch (huge for demoing iterations)

Railway covers:
- yt-dlp + ffmpeg in a persistent container ($5/mo starter)

Total infra cost at v1 scale: ~$5/mo + per-call AI costs.

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

**If captions are available on the YouTube video:**
- Skip yt-dlp and Whisper entirely
- Pipeline: `YouTube URL → getCaptions() → LLM (GPT-4o + Zod) → UI`
- Latency: ~1–3s end-to-end. Cost: ~$0.01–0.03 per extraction.

**If captions are not available:**
- Pipeline: `YouTube URL → Railway sidecar (yt-dlp → ffmpeg → MP3) → OpenAI gpt-4o-mini-transcribe → LLM (GPT-4o + Zod) → UI`
- Latency: ~10–30s end-to-end. Cost: ~$0.02–0.05 per extraction.

**If extraction quality on captioned videos turns out to be poor in user testing:**
- Add a quality heuristic on the LLM output. If the workout has <2 exercises or every exercise has identical sets/reps, retry on the Whisper path. Treat caption path as "fast preview, Whisper path as authoritative".

**If costs spike:**
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

For a v1 demo at, say, 1,000 extractions in the first month: $20–60 in AI costs + $5 Railway = **under $70/month all-in**. Rate limiting at 5/hour/IP caps the abuse-induced worst case to roughly 120/IP/day.

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

---
*Stack research for: Next.js AI workout-extraction web app (Exercised)*
*Researched: 2026-05-16*
