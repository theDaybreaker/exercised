# Project Research Summary

**Project:** Exercised
**Domain:** AI-powered YouTube workout-extraction web app (Next.js + Vercel, mock-first → real pipeline)
**Researched:** 2026-05-16
**Confidence:** HIGH

## Executive Summary

Exercised is a "paste a YouTube URL, see a premium structured workout in seconds" web app. The product sits at the intersection of two mature categories (AI YouTube summarizers and premium fitness apps) that nobody has yet bridged well — and the gap *is* the differentiation. Research is unanimously positive on the front-end stack (Next.js 16 App Router + Tailwind 4 + shadcn/ui + Motion + Vercel AI SDK with Zod-constrained `generateObject`), on the LLM choice (GPT-4o via Structured Outputs, Gemini 2.5 Flash as the cost-swap alternative), and on the loading UX pattern (real SSE stage events from day one — even from the mock).

The recommended approach is **mock-first, two-service, captions-before-Whisper**. Phase 1 ships a complete, deployable, premium-looking UI against a mocked `/api/extract` that streams real SSE stage events from a fixture. Phase 2 swaps in a real pipeline that **tries YouTube captions first** (10× cheaper than Whisper, ~$0.01 vs ~$0.05 per extraction), falling back to audio-transcription only when needed. Crucially, the audio path **cannot run inside a Vercel function** — YouTube's 2025 datacenter-IP and PoToken crackdown plus the 250 MB function ceiling make this a project-killer if attempted. The fix is a hosted transcript service (Supadata/Apify) or a tiny Railway/Fly sidecar running yt-dlp + ffmpeg. Vercel's Fluid Compute now gives Hobby a 300s timeout (the old 10s cap is outdated), so SSE in a single streamed function handler is the right answer through tens-of-thousands of users.

The two existential risks are **cost blow-up** (anonymous + paid AI = a Hacker News post can produce a $1,500 OpenAI invoice overnight) and **LLM hallucination** (Structured Outputs guarantee shape, not truth — the LLM will confabulate exercises from a music-only video and the premium positioning collapses on first "I never said that"). Both are addressed in the same PR as the first real OpenAI key, via 8 layered cost defenses (captions-first, rate limit, daily cap, OpenAI budget cap, Vercel spend cap, URL allow-list, duration cap, cache) and a transcript-evidence round-trip + closed exercise enum + honest low-confidence empty state. The third non-negotiable: **lock the JSON schema in Phase 1 with forward-looking fields** (`startTimestamp`, `sourceQuote`, `muscleGroups`, `difficulty`, `equipment`) even if not all are rendered initially — schema migration is expensive.

## Key Findings

### Recommended Stack

The stack collapses to one prescriptive choice in nearly every category with no real second-guessing in 2026. The only architectural fork is yt-dlp's deployment location, and the brief itself flagged that risk — research confirms it.

**Core technologies:**
- **Next.js 16 App Router + TypeScript 5.6 + Tailwind CSS 4** — locked by brief; 2026 default for AI web apps with first-class streaming
- **shadcn/ui + next-themes + Motion 12** — premium dark glassmorphism, accessible Radix primitives in-repo, `AnimatePresence` is exactly the loading-stage cycle the brief calls for
- **Vercel AI SDK 6 (`generateObject` with Zod)** — Zod schema → OpenAI Structured Outputs → grammar-level schema conformance; one-line swap between GPT-4o and Gemini for cost A/B
- **`gpt-4o-mini-transcribe`** (not legacy `whisper-1`) — cheaper *and* more accurate; `gpt-4o-2024-11-20` for LLM extraction
- **Zod 4 schema as single source of truth** — same schema constrains LLM output, validates mock fixtures, types the UI
- **Upstash Redis + `@upstash/ratelimit`** — sliding-window per-IP rate limit AND a 30-day TTL cache by `videoId` (same store, two purposes); HTTPS REST, edge-compatible
- **`youtube-caption-extractor` + `youtube-transcript`** (fallback pair) — caption-path short-circuit that's the single biggest cost lever in v1
- **Railway (or Fly.io) sidecar** — Node/Fastify wrapper around yt-dlp + ffmpeg, ~50 LOC, $5/mo; the only viable place to put yt-dlp
- **Geist (or Inter+Outfit) via `next/font`** — premium typography with zero CLS

Full detail in [STACK.md](./STACK.md). Total infra at v1 scale: ~$5/mo Railway + per-call AI (~$20–60/month for 1k extractions) = under $70/month all-in.

### Expected Features

The brief is unusually complete. Research validates the spec and adds a small set of schema-level differentiators that are nearly free to bake in now and expensive to retrofit later.

**Must have (table stakes):**
- Prominent URL input + client-side YouTube URL regex validation before submit
- Honest pipeline status driven by **real server events**, not faked `setTimeout` carousel (the cliché is faking it, not the pattern itself)
- Skeleton cards during loading (not just a spinner)
- Workout output: title, creator, duration, muscle-group pill tags, exercise list, superset visual grouping
- Exercise cards: name, sets, reps, rest, expandable form cues
- Source video link + creator credit (trust signal #1 for AI-extracted content)
- Copy-to-clipboard (markdown + plain text) — primary "save" mechanism in an anonymous app
- Error / empty / no-workout-detected state with distinct copy per failure mode
- Rate-limit-error UX with friendly tone, not a 429 dump
- Mobile responsive throughout (half of users will paste from their phone near a gym)
- Premium dark-mode glassmorphism aesthetic — **with ambient gradient background**, not flat black

**Should have (competitive differentiators):**
- **Per-exercise jump-to-timestamp button** ("↪ 2:14 in video") — highest-leverage trust feature; requires `startTimestamp` in schema NOW
- **Source-quote popover per exercise** — academic-grade trust pattern; requires `sourceQuote` in schema NOW
- **Share via URL-encoded state** (`lz-string` compress workout JSON into URL params) — the killer no-auth feature; needs schema versioning (`v=1`) from day 1
- Difficulty + equipment chips — both schema fields
- Anatomy silhouette mini-diagram with highlighted muscles (Hevy-style polish)
- Print-styled view via `@media print` CSS (no server PDF)
- Footer-level AI disclaimer

**Defer (v2+):**
- User accounts, save/library, active workout tracker, rest timer — **explicitly out of scope**
- TikTok / Instagram Reels ingestion — fragile, auth-walled
- Multi-language extraction — prompt tuned for English
- AI chatbot on output — anti-feature; drains budget
- Generated exercise illustrations — actively harms trust
- Soft paywall / monetization — premature before extraction quality is validated

Full detail in [FEATURES.md](./FEATURES.md). Schema-level pre-commitments (`startTimestamp`, `sourceQuote`, `muscleGroups`, `difficulty`, `equipment`) are the single most important call-out for roadmap planning.

### Architecture Approach

**Two-service, mock-first, SSE-from-day-one.** Next.js on Vercel owns UI, `/api/extract`, rate limiting, caption-first short-circuit, and the LLM extraction call. A tiny Railway/Fly sidecar (or hosted Supadata/Apify API) owns yt-dlp + ffmpeg for the audio-fallback path. The frontend is a Server Component shell with a single Client Component island (`<ExtractFlow />`) owning a `useReducer` state machine (`idle → submitting → streaming → success | error`). The route handler returns a streamed `text/event-stream` response and selects the mock vs. real `ExtractionService` implementation behind an env-var feature flag — frontend never knows the difference.

**Major components:**
1. **`<ExtractFlow />`** (Client Component) — owns the state machine and SSE consumption; the only client island on the landing page
2. **`<WorkoutView />` / `<ExerciseCard />` / `<SupersetCard />`** — pure render components driven by parsed `Workout` props
3. **`/api/extract` Route Handler** — Zod-validates input, picks `ExtractionService` from env, streams SSE events; `export const maxDuration = 300` (Fluid Compute)
4. **`MockExtractionService` / `RealExtractionService`** — TS interface; mock yields fixture events with timed delays; real orchestrates cache → captions → (audio fallback → Whisper) → LLM with `generateObject(WorkoutSchema)` → cache write
5. **`lib/schema/workout.ts`** — single Zod source of truth; types inferred via `z.infer`
6. **Upstash Redis** — `workout:v1:${videoId}` cache with 30-day TTL + per-IP rate-limit counters (same store, two roles)
7. **Caption/audio source** — Supadata API (recommended start) or Railway/Fly sidecar (escape hatch); never inside a Vercel function

Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md). Key decisions: SSE not polling, `useReducer` not Zustand, service factory not two routes, Zod schema not separate TS interface, cache from day one of Phase 2.

### Critical Pitfalls

Top 5 from [PITFALLS.md](./PITFALLS.md).

1. **yt-dlp on Vercel hits YouTube's bot wall.** YouTube's 2025 datacenter-IP + PoToken crackdown + Vercel's 250 MB function ceiling = local works, deployed half-fails. **Avoid by:** captions-first short-circuit (covers ~80% of fitness content), audio fallback on Railway/Fly or Supadata — never inside a Vercel function. *Address in Phase 1 spike before any architecture locks.*
2. **LLM hallucinates exercises that weren't in the video.** Structured Outputs guarantees shape, not truth. **Avoid by:** `nullable` fields on optional values, transcript-evidence round-trip per exercise (validate `transcript.includes(evidence)`), closed exercise enum (~200 common exercises with synonyms), honest low-confidence empty state, eval set of 5–10 hand-labeled videos including 1 non-fitness control. *Address in real-pipeline phase.*
3. **Anonymous endpoint + paid AI APIs = bill blow-up.** **Avoid by:** 8 layered defenses shipped in the same PR as the first real key — captions-first, Upstash IP rate limit (~3–5/min, ~20/day), global daily spend cap in Redis, OpenAI dashboard budget cap, Vercel Spend Management cap, YouTube URL allow-list, video duration cap pre-Whisper, `videoId` cache. *Address in real-pipeline phase — non-negotiable.*
4. **Fake cycling loading states betray the product on fast or slow responses.** **Avoid by:** stream stage events from the API (mock too), UI reacts to events not timers, minimum 300ms dwell per stage for polish. *Address in Phase 1 UI build.*
5. **Dark-mode glassmorphism executed as a 2014 Dribbble pastiche.** **Avoid by:** ambient gradient background with vibrant color orbs, boost card opacity to 10–15%, 1px ~10% white border, neon-as-glow not neon-as-text, programmatic WCAG 4.5:1 enforcement. *Address in Phase 1 UI build.*

Secondary but real: yt-dlp version churn (daily smoke test), transcript-to-workout fidelity is structurally limited for music-only/follow-along content, cold-start + Whisper latency, mock-to-real contract drift (shared Zod schema solves it), legal exposure (DMCA contact page, no transcript retention, no creator-specific marketing).

## Implications for Roadmap

Suggested 4-phase shape. Phases 1–2 are sequential and load-bearing; phases 3–4 can swap order based on traffic signals.

### Phase 1: Mock-Deployable Premium UI
**Rationale:** PROJECT.md and FEATURES.md both treat the UI as core value, not paint. ARCHITECTURE.md's whole premise is that a mocked `/api/extract` with the same SSE streaming contract lets the UI ship and get deployed *before* any AI integration risk. The schema, the SSE contract, and the glassmorphism execution must all be right *in this phase* or they're expensive to fix later.
**Delivers:** A deployed-to-Vercel demo URL with a complete UI — paste a URL, see streaming stage events, see a fully-rendered fixture workout with cards, supersets, copy-to-clipboard, share link, error/empty states, mobile responsiveness, all in premium dark glassmorphism. Plus the schema lock and DMCA contact page.
**Addresses:** All P1 features from FEATURES.md.
**Avoids:** PITFALLS #6 (glassmorphism), #7 (fake loading states), #9 (mock-real contract drift), #10 (legal exposure setup).
**Includes a 30-min Phase 0 spike:** Deploy a Hello-World Vercel function calling yt-dlp against 3 YouTube URLs. If 2+ fail, lock the architecture decision (captions-first + Supadata or Railway sidecar) before Phase 2 commits.

### Phase 2: Real Pipeline (Captions-First) + Cost Protections
**Rationale:** Schema locked, UI works. Make extraction real. Captions-first because it covers most YouTube fitness content at 10× lower cost and 10× lower latency — and sidesteps the yt-dlp/Vercel pitfall entirely for the common path. All cost protections ship in the same PR as the first real OpenAI key.
**Delivers:** Real `/api/extract` fetching YouTube captions, sending to GPT-4o with `generateObject(WorkoutSchema)`, caching by `videoId`, rate-limiting per IP, enforcing daily spend cap, validating with transcript-evidence round-trip and closed exercise enum, surfacing `extraction_confidence` honestly in the UI. Daily smoke test live.
**Uses:** Vercel AI SDK 6 + `@ai-sdk/openai`, Zod 4, Upstash Redis + `@upstash/ratelimit`, `youtube-caption-extractor` + `youtube-transcript` fallback pair.
**Implements:** `RealExtractionService` (captions branch only), `lib/extraction/captions.ts`, `lib/extraction/structure.ts`, `lib/extraction/cache.ts`, `middleware.ts` for rate limit.
**Avoids:** PITFALLS #1, #2, #3, #5.

### Phase 3: Audio Fallback (Whisper Path) for Uncaptioned Videos
**Rationale:** Captions cover most but not all YouTube fitness content. Without this phase, the demo silently fails on uncaptioned videos. The yt-dlp deployment decision (Supadata vs. Railway/Fly sidecar) gets made for real here, informed by Phase 1's spike result and Phase 2's observed traffic.
**Delivers:** Whisper-fallback branch — for uncaptioned videos, fetches audio (via Supadata's AI fallback OR a Railway/Fly sidecar), runs `gpt-4o-mini-transcribe`, then the same LLM extraction path. Pre-Whisper duration cap. Audio cleanup.
**Uses:** OpenAI `gpt-4o-mini-transcribe`, sidecar host OR hosted transcript API depending on Phase 2's signal.
**Avoids:** PITFALLS #1 (yt-dlp lives off-Vercel), #4 (version churn — smoke test extends to this path), #8 (cold-start + Whisper latency).

### Phase 4: Trust + Polish Differentiators
**Rationale:** Phases 1–3 deliver the core value. Phase 4 layers in the differentiators that earn the "premium" label and the trust the LLM can't earn on its own — many scaffolded into the schema in Phase 1 but not yet rendered.
**Delivers:** Per-exercise jump-to-timestamp links, source-quote popover, difficulty/equipment chips, anatomy silhouette mini-diagram, share-via-URL-encoded-state polish, print stylesheet, inline edit of numeric fields, recently-extracted URLs in localStorage, "⚡ Cached" badge.
**May reorder with Phase 3** if early traffic shows most workout videos are captioned and polish payoff > coverage payoff.

### Phase Ordering Rationale

- **Schema lock + SSE contract in Phase 1 is load-bearing.** Adding schema fields after fixtures, share links, and the LLM prompt are in the wild means re-prompting, re-fixturing, re-rendering, and breaking existing share URLs.
- **Captions-first before audio fallback** because it's 10× cheaper, 10× faster, covers most YouTube fitness content, and sidesteps the yt-dlp/Vercel pitfall entirely.
- **All 8 cost defenses ship in the same PR as the first real key** — anything else risks a project-killer invoice in the first 24h.
- **Audio fallback is its own phase** because choosing between Supadata and Railway/Fly is informed by observed Phase 2 traffic and quality.
- **Trust/polish (Phase 4) deliberately last** because half its features depend on the LLM eval set being stable from Phase 2.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 — UI/glassmorphism research-phase recommended.** Glassmorphism done badly is the difference between "premium" and "2014 Dribbble". Worth a focused pre-build pass on color tokens, ambient background, contrast, and the 1–2 motion moments.
- **Phase 2 — Prompt + eval set deserve their own research-phase mini-cycle.** Hallucination is the existential risk; spike on (a) closed exercise enum + synonyms, (b) transcript-evidence schema field, (c) eval-set construction. ~1 day.
- **Phase 3 — Audio fallback host decision needs a research-spike.** Half-day at the top of Phase 3 to verify pricing, current YouTube-blocking posture, and hello-world deployment of the chosen option.

**Phases with standard patterns (skip research-phase):**
- **Phase 4 — Trust/polish features** are mostly schema-already-decided UI work. Patterns are well-documented.
- **Cost-protection layer in Phase 2** has prescriptive guidance already — implement the 8-layer defenses directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every library verified against current npm versions; Vercel limits verified against official docs; OpenAI pricing verified live |
| Features | MEDIUM-HIGH | High on UX/AI-tool patterns and fitness-app conventions; medium on exact differentiator priorities — niche has few direct competitors |
| Architecture | HIGH | Vercel limits, Next.js streaming patterns, Zod + AI SDK integration verified against official docs; only MEDIUM is exact yt-dlp host choice |
| Pitfalls | HIGH for serverless/cost/UX, MEDIUM-LOW for legal | Cost and bot-block pitfalls have many corroborating sources; 2026 DMCA/§1201 ruling is genuinely unsettled |

**Overall confidence:** HIGH

### Gaps to Address

- **yt-dlp host choice (Supadata vs. Railway/Fly).** Defer decision to Phase 3, after Phase 2 traffic informs it.
- **Cached vs. fresh extraction UX.** Cache hits return in ~0.8s; first-extract on Whisper path takes 25s+. Ship invisible in Phase 2, evaluate in Phase 4.
- **Caption quality threshold for fitness content.** Track extraction-quality drop on captioned-vs-Whisper in Phase 2 monitoring; if measurably worse, add "low-confidence caption" retry-on-Whisper heuristic in Phase 3.
- **Legal posture before public launch.** DMCA contact + no-transcript-retention from Phase 1; lawyer consult before monetization, not blocking v1 demo.
- **Mobile glassmorphism performance.** `backdrop-filter` expensive on mid-range Android. Test on real devices in Phase 1; fall back to reduced-opacity-without-blur on low-power devices if needed.

## Sources

### Primary (HIGH confidence)
- **Vercel docs:** Functions Limits, Fluid Compute changelog, Function Duration, 250 MB limit guide, Edge Runtime, Rate-limit template, Limit Abuse KB
- **Next.js docs:** Streaming guides, Server and Client Components, `use client` reference
- **Vercel AI SDK docs:** `generateObject` reference, Generating Structured Data, AI SDK 5 release post, Caching
- **OpenAI:** API pricing, Structured Outputs guide (including hallucination caveat)
- **Upstash:** Ratelimit overview, Vercel marketplace integration, Edge rate limiting blog
- **yt-dlp project:** Issues #10128, #15800, #15899; PO Token Guide wiki
- **npm live versions:** `ai@6.0.184`, `motion@12.38.0`, `@upstash/ratelimit@2.x`, `@ai-sdk/openai@3.x`, `geist@1.x`, `youtube-caption-extractor@1.10.x`
- **Tooling docs:** shadcn/ui dark mode, Motion docs

### Secondary (MEDIUM confidence)
- SSE community write-ups (Upstash blog, Medium fixing slow SSE on Vercel)
- Worker / off-Vercel options (Modal, Fly.io vs Vercel pattern, Supadata, Apify)
- Benchmarks (Artificial Analysis WER, Gemini vs GPT-4o cost)
- UX research (UX Patterns AI Loading/Error States, NN/g Skeleton screens, ACM Confidence indicators)
- Competitive analysis (Glasp, Heuristica, Side Copilot, NoteGPT; Hevy, FitNotes, AnyDistance)
- Cost/abuse reports (Vercel community, pricing breakdowns)
- Design patterns (Dark Glassmorphism 2026, Hevy muscle-group chart)
- State patterns (useReducer FSM, shared Zod schemas)

### Tertiary (LOW confidence — needs validation)
- **Legal:** 2026 DMCA / §1201 ruling articles — landscape is genuinely unsettled
- **Vendor pricing:** Supadata, Apify Whisper-fallback rates — verify with live account before locking in Phase 3
- **Yozora yt-dlp-on-Vercel proof-of-concept** — existence proof; does not contradict broader unreliability

---
*Research completed: 2026-05-16*
*Ready for roadmap: yes*
