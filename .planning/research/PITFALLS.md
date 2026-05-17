# Pitfalls Research

**Domain:** AI-powered workout-extraction web app (Next.js + Vercel + yt-dlp + Whisper + LLM, anonymous v1)
**Researched:** 2026-05-16
**Confidence:** HIGH for serverless/cost/UX pitfalls (multiple official + community sources); MEDIUM for extraction-fidelity expectations (inferred from adjacent product behavior, limited direct precedent); MEDIUM-LOW for legal risk profile (genuinely unsettled in 2026)

---

## Critical Pitfalls

### Pitfall 1: yt-dlp on Vercel hits YouTube's bot wall and stays there

**What goes wrong:**
You ship the real pipeline. The first few extractions on localhost work. You deploy to Vercel. Half your requests come back `HTTP 403 — Sign in to confirm you're not a bot`. The other half work for 20 minutes, then YouTube bans the ASN for hours. You have a "working" demo that fails for most users most of the time.

**Why it happens:**
YouTube now blocks at the ASN / IP-range level, and AWS, GCP, Azure, and Vercel's underlying infra are the primary targets. Vercel functions run on AWS Lambda — IP ranges already flagged as data-center traffic. yt-dlp's default fragment retries make this *worse* (each retry burns trust). The fix that works locally (`--cookies-from-browser`) doesn't transfer to a stateless function, and `--cookies` exports rotate quickly because YouTube rotates session cookies on every open tab. The current stable path is a **PO Token provider** plus rotating cookies — both of which are stateful and require an outside-Vercel service. The yt-dlp wiki explicitly says in 2026 a "just works" command is now a "PO Token provider, fresh cookies, and a little patience" command.

**Severity:** **PROJECT-KILLER for "Vercel-only" plan.** Multi-day detour minimum if discovered late; potential pivot of entire backend deploy target.

**How to avoid:**
- **Decouple the video-fetch step from Vercel functions.** Treat Vercel as the API/UI layer; treat yt-dlp as a worker on infrastructure that isn't on a blocked ASN. Concrete options, in order of effort:
  1. **Prefer captions over audio.** For English workout videos that have captions (most monetized creator content does), skip yt-dlp's audio path entirely. Use `youtube-transcript-plus` or the Innertube approach via a Node lib. No binary, no IP-rep risk on the audio download, no Whisper cost. This sidesteps ~80% of the problem.
  2. **Audio fallback runs on a worker, not on Vercel.** Modal, Fly.io, or Railway with a residential or rotating proxy + PO Token provider. Vercel function POSTs the URL to the worker, polls for result. (Modal is Python-native and fits yt-dlp directly; Fly/Railway run Docker so you can install ffmpeg + yt-dlp in the image.)
  3. **Hosted transcript-with-fallback service.** Supadata, Apify YouTube Transcript Scraper, or similar. ~$0.001/video for caption pulls, ~$0.012/min for Whisper fallback. You pay for someone else to keep yt-dlp working.
- **Plan binary size early.** Lambda compressed bundle is 50 MB; uncompressed (incl. Layers) is 250 MB. yt-dlp + Python + ffmpeg blow past this without care. If you must put it on Vercel/Lambda, ffmpeg layer is required (see `serverlesspub/ffmpeg-aws-lambda-layer`), and tmp storage is 512 MB — a long video's audio chunks will saturate it.

**Warning signs:**
- Local works, deployed fails. (#1 signal — investigate IP/ASN block immediately.)
- Sporadic 403s that cluster in time (ASN-level rate limiting kicking in).
- Errors mention "Sign in to confirm you're not a bot" or `--cookies`.
- yt-dlp version churn — recent releases ship faster than Vercel rebuilds.

**Phase to address:**
**Phase 1 spike — before any UI work commits to the architecture.** Run a 30-minute probe: deploy a Hello-World Vercel function that calls yt-dlp on three different YouTube URLs. If two of three 403, you know the architecture before you build the UI on the wrong assumption. If captions-first works, lock that as the primary path and treat audio as the fallback.

---

### Pitfall 2: LLM hallucinates exercises that weren't in the video

**What goes wrong:**
Whisper transcribes "we're going to crush some pull day". The LLM, asked to fill a JSON schema with `exercises: Exercise[]`, helpfully invents a plausible pull workout: lat pulldowns, rows, biceps curls — none of which were named. Structured Outputs *guarantees* the JSON is valid, but values are still inferred. Users see exercises the creator never did. The premium product is suddenly worse than just reading the video description.

**Why it happens:**
OpenAI's own docs are explicit: "While Structured Outputs aim for schema adherence, the model might still hallucinate values, particularly if the input is significantly unrelated to the schema." Workout videos *are* related to the schema, but loosely — many creators show movements without naming them, use slang ("RDLs", "tris", "BB curls", "pushups + claps"), or talk over background music. The LLM fills the gaps. Worse, it does so confidently in well-typed JSON, which makes the failure invisible at the schema layer.

**Severity:** **Project-killer for "premium" positioning.** A product that confabulates is worse than no product. Multi-day detour to fix correctly (eval harness + prompt + retry strategy).

**How to avoid:**
- **Use OpenAI Structured Outputs `strict: true` with `nullable` fields for everything optional.** OpenAI's guidance: nullable types let the model return `null` instead of inventing values. Apply this to `rest`, `weight`, `form_cues`, anything that isn't always present.
- **Add an explicit "low-confidence / unclear" exit in the prompt.** Something like: "If the video doesn't clearly state an exercise name, set the exercise field to null and add a `transcript_evidence` quote. Never invent exercises." Pair with a top-level `extraction_confidence: "high" | "medium" | "low"` and a `notes` field where the LLM can say "this video had no clear narration; output is best-effort."
- **Round-trip every exercise to a `transcript_evidence` quote.** Require the LLM to emit, for each exercise, the exact substring from the transcript that mentioned it. Then post-validate: if `transcript.includes(evidence)` is false, the LLM hallucinated. Re-prompt or fail soft.
- **Constrain `name` to a known exercise vocabulary when possible.** Hevy's approach (Gemini compared against the official Hevy exercise list) is the right shape — a closed enum prevents free-form invention. v1 can ship a curated list of ~200 common exercises with synonyms ("RDL" → "Romanian Deadlift"); LLM picks `closest_match` or `unknown`.
- **Empty-state UX is a feature, not an error.** Music-only videos, dance fitness, follow-along without narration: the right output is "We couldn't reliably extract a workout from this video" — *not* a confident wrong answer. Build the empty/low-confidence UI before tuning the prompt.

**Warning signs:**
- During fixture testing, the LLM outputs full workouts from prompts with no exercise content. (Test this deliberately: pass a transcript of a cooking video.)
- `transcript_evidence` quotes don't actually appear in the transcript.
- All extractions have suspiciously similar rep ranges (3x10, 4x12) — sign the LLM is defaulting to common patterns rather than reading the transcript.
- Creator complaints: "I never said biceps curls in that video."

**Phase to address:**
**Real-pipeline phase (the one that swaps mock → real LLM).** Before that phase ships, build a small eval set: 5–10 hand-labeled videos including 1–2 with no narration and 1 non-fitness video. Block ship until extraction precision is acceptable on the eval set.

---

### Pitfall 3: Anonymous endpoint + paid AI APIs = bill blow-up

**What goes wrong:**
Demo goes up. Someone posts on HN/Reddit/Twitter. A script kiddie writes a 5-line loop that hits `/api/extract` with 10,000 random YouTube URLs. Or an AI bot crawler indexes the endpoint. By morning: 10,000 × (15-min video × $0.006/min Whisper + GPT-4o tokens) = ~$1,500+ on the OpenAI bill, plus Vercel function-GB-hours. There's no auth, no rate limit, no per-user cap. Vercel community has documented cases of Hobby plans being throttled and Pro plans hitting $286 from a $20 expectation; AI workloads amplify this dramatically.

**Severity:** **Project-killer (financially).** Single-night detour to add rate limiting — but if you discover it the wrong way (the invoice), recovery is "eat the bill and add it after."

**How to avoid (concrete, layered defenses — every one of these, not pick-one):**

1. **Caption-first short-circuit.** Bypass Whisper entirely when YouTube captions exist. Cuts ~$0.09/15-min-video to $0. This is the single biggest cost win and also helps Pitfall 1.
2. **IP-based rate limiting with `@upstash/ratelimit` at the edge.** Vercel + Upstash template exists; recommended config for paid-AI endpoints: ~3–5 requests per IP per minute, and ~20 per IP per day. Edge middleware blocks before the function spins up. Listed in the active requirements already — treat as non-optional.
3. **Global daily spend cap.** Maintain a Redis counter of total Whisper+LLM cost-cents per UTC day; refuse new extractions when the cap is hit. Show "Daily demo quota reached, come back tomorrow." Even a $10/day cap protects against catastrophic overruns while leaving the demo functional.
4. **OpenAI dashboard hard budget.** Set a usage limit in the OpenAI platform settings (`Settings → Limits → Monthly budget`). When the API hits the cap, requests fail rather than billing — much better failure mode than a $1,500 invoice. This is a config-page click, not code.
5. **Vercel Spend Management cap.** Set explicit team-level spend cap (default $200; set it lower for v1). Hobby plan auto-protects (hard stop, no overage); Pro plan does not by default — must be configured.
6. **YouTube URL allow-list.** Reject non-YouTube URLs at the API boundary (regex `(youtube\.com|youtu\.be)`). Stops half of the abuse vectors (general-purpose video downloader misuse) trivially.
7. **Video duration cap pre-Whisper.** yt-dlp's `--print duration` (or metadata fetch) returns video length cheaply. Refuse videos > ~30 min before incurring transcription cost. Most workout videos are 5–45 min; the abuse case ("transcribe this 4-hour podcast") is filtered.
8. **Cache aggressively by `youtube_id`.** Same URL twice = serve from KV cache. Real cost only on first extraction. Workout-creator videos are likely to be shared, so this compounds. Also enables "this video has already been extracted" instant-return UX.

**Warning signs:**
- Spike in `/api/extract` requests from a single IP or ASN.
- OpenAI dashboard shows unexpected daily usage growth.
- Same URLs appearing in logs repeatedly (cache not working).
- Long videos appearing (>30 min — workout videos are usually shorter).

**Phase to address:**
**The phase that introduces the real pipeline (whichever phase swaps mock → real).** Rate limit, daily cap, caching, allow-list, and OpenAI dashboard cap **all** ship in the same PR as the first real Whisper/LLM call. Not as a follow-up. No real API key gets deployed without #2, #3, #4, #6 active.

---

### Pitfall 4: yt-dlp version churn — silently breaks weekly

**What goes wrong:**
You pin yt-dlp at the version that worked on Tuesday. YouTube ships a player update on Thursday. By Friday your production extractions return junk metadata or 0-byte audio. The deploy looks healthy (no errors), but extractions fail silently because the LLM dutifully processes empty transcripts.

**Why it happens:**
yt-dlp is a moving target by design — it ships fixes faster than YouTube ships breakage, but only if you take updates. Pinning a version freezes you on the wrong side of that race. Plus PO Token formats and Innertube clients rotate.

**Severity:** Multi-day detour the first time it surprises you. Minor if monitoring catches it within hours.

**How to avoid:**
- **Pin yt-dlp by version, but also run a daily smoke test.** Vercel cron or GitHub Actions hits `/api/extract` with three known-good YouTube URLs daily. Alert on regression (0 exercises extracted, error rate spike).
- **Update yt-dlp on a schedule, not on demand.** Weekly Renovate/Dependabot bump + smoke run is much less painful than the 2am scramble.
- **Empty-transcript guard.** If the transcript is < some minimum length, fail before hitting the LLM — don't pay GPT-4o to hallucinate from `""`.
- **Capture the failure mode in error tracking.** Sentry / log a structured error when extraction succeeds but produces empty data. "Successful failure" is the worst kind.

**Warning signs:**
- Sudden drop in `exercises.length > 0` rate.
- Transcripts shorter than usual / empty.
- LLM `extraction_confidence: "low"` rate climbs.

**Phase to address:**
**The phase that ships the real pipeline.** Smoke test + monitoring is part of "the real pipeline is done," not a follow-up.

---

### Pitfall 5: Transcript-to-workout fidelity is structurally limited

**What goes wrong:**
The pipeline works perfectly on the 30% of content that's a creator narrating "we're doing 4 sets of 8 reps Romanian deadlifts, 90 seconds rest, focus on hip hinge." It fails on:
- **Music-only workout videos** (HIIT classes, dance fitness) — no narration, exercises shown not named.
- **Follow-along videos** where the creator does the movement without naming it ("ready? go" + 30 jumping jacks).
- **Slang and abbreviations** — "RDLs", "tris", "T-bar", "DB" — that may or may not survive Whisper, and may or may not be in the LLM's vocabulary.
- **Long preamble** — 5 minutes of intro/sponsor, 2 minutes of actual workout. Whisper transcribes both; LLM may pull exercise names from the *intro talking points* rather than the workout.
- **Multi-language content** — even if creator switches languages mid-video (English instructor, Spanish music + commentary).

If marketing copy promises "paste any workout URL," the long tail of failure is high.

**Severity:** Reputation killer if oversold; not a tech bug, a positioning bug. Multi-day detour if discovered after public launch (need to scope content types, add filters, rewrite landing-page copy).

**How to avoid:**
- **Constrain the marketing claim, not the pipeline.** "Works best with narrated workout videos" is the honest claim. Show example URLs on the landing page that *are known to work* — users self-select into supported content.
- **Detect-and-deflect for known-bad content types.** If `transcript.length / video.duration_min < some_threshold`, the video is mostly silent/music — return "this video doesn't have enough narration to extract a workout" empty-state, don't even hit the LLM.
- **Curated test set drives the marketing.** Maintain a list of 10–20 known-good creator videos used for smoke testing *and* shown on the landing page as "try these." Demo videos = test set = marketing.
- **Confidence is a first-class field in the JSON contract.** Match the schema decision in the active requirements with `extraction_confidence` and surface it in the UI (a subtle "high-confidence extraction" or "best-effort extraction — verify with the original video" badge). Honest UX, not hidden uncertainty.
- **Slang dictionary in the prompt.** A few-shot example or short glossary ("RDL = Romanian Deadlift, tris = triceps, DB = dumbbell, BB = barbell") goes a long way. Iterate as you discover gaps.

**Warning signs:**
- Eval set shows >20% disagreement on exercise names (after re-prompt).
- Users report "this isn't the workout in the video."
- The same exercise name appears with wildly different rep ranges across re-extractions (LLM coin-flipping in absence of signal).

**Phase to address:**
**The real-pipeline phase.** The empty-state and low-confidence UI from Pitfall 2 covers this technically; the *positioning* fix belongs to whichever phase finalizes the landing-page copy.

---

### Pitfall 6: Dark-mode glassmorphism executed as a 2014 Dribbble pastiche

**What goes wrong:**
The brief says "premium dark mode, glassmorphism, neon accents." Executed naively: full-blur frosted-glass cards on a flat `#0a0a0a` background, neon-green text at 60% opacity, gradient borders, hover glows on everything. Result: looks like a 2014 portfolio shot, not a 2026 product. Contrast fails WCAG. The "premium" intent that's supposed to be core value evaporates.

**Why it happens:**
Glassmorphism only reads as premium when there's *something behind the glass*. Flat dark backgrounds + transparent cards = nearly invisible panels (modern UI design discussions consistently flag this). Neon accents at low contrast fail accessibility. Animations on every element = noise, not polish.

**Severity:** Reputation killer for a product whose stated core value is "feels premium." Multi-day detour to fix late; cheap to get right early.

**How to avoid:**
- **The background does the heavy lifting.** Ambient gradients with vibrant color orbs (deep purples, deep blues, subtle hot accents) floating behind the UI. Glassmorphism cards then have *something* to refract. Without that, dark glassmorphism reads as black-on-black.
- **Boost panel opacity for the dark variant.** Specifically: translucent layers fade into inky backgrounds. Increase card background opacity (~10–15% rather than 4–5%), add a subtle border (1px, ~10% white), and a darker scrim behind text blocks.
- **Enforce WCAG 4.5:1 for body text, 3:1 for large text — programmatically.** Test every neon/body-text combination in Stark, Figma's contrast checker, or `axe`. Neon green at low opacity will fail. The fix is usually "make neon accents the border/glow, not the text color."
- **Pick one or two motion moments, not eight.** A hover micro-animation on the primary CTA, a satisfying card reveal — not glow on every pill and shadow on every icon.
- **Lock typography early.** Inter for UI, Outfit for display. One weight scale (400, 500, 600, 700). Resist adding fonts mid-build.

**Warning signs:**
- Designer feedback: "looks dated" or "looks like every fintech landing page."
- Contrast checker fails on primary text.
- More than two animated elements visible at once.
- Glassmorphism cards barely distinguishable from the background.

**Phase to address:**
**Phase 1 UI build.** This is core value — get the visual language right against the mock data before the real pipeline lands. Avoid the "we'll polish it later" trap.

---

### Pitfall 7: Fake cycling pipeline messages when the real pipeline is sub-3-second

**What goes wrong:**
The brief specifies cycling loading states: "Fetching… → Transcribing… → Analyzing form cues… → Generating routine…". Built against the 3-second mock, it looks great. But when the real pipeline does captions-first (no Whisper) on a cached video, the response returns in 800ms — and the UI is still cycling through fake "Transcribing audio…" text for content that was never transcribed. Users notice. It feels theatrical, then dishonest.

The mirror failure: real pipeline takes 22 seconds (Whisper fallback on uncached video). The UI cycles through all four messages in 12 seconds and then sits on "Generating routine…" for the next 10 seconds, anxiously.

**Severity:** Minor-to-moderate. Trust-erosion if users repeat-extract and notice the same "fake progress." Cheap to fix correctly.

**How to avoid:**
- **Stream stage events from the API, don't fake them in the client.** Use Vercel's streaming response (works in both Edge and Node runtimes). The API emits `{ stage: "fetching" }`, `{ stage: "transcribing" }`, `{ stage: "extracting" }`, `{ stage: "done", payload: {...} }`. The UI reacts to actual events. If captions-first skips transcription, the user never sees "Transcribing."
- **Honest minimum dwell time per stage.** Even on a fast response, hold each stage 300–500ms so the UX doesn't strobe. That's polish, not deception.
- **Skeleton card for the workout result is up immediately.** Per current UX research, skeletons reduce perceived wait vs. spinners *because they show what's coming*. Show the exercise-card outline immediately on submit; fill it as data arrives. This pattern is well-established for AI loading.
- **Mock the streaming contract too.** The mock `/api/extract` should also emit streamed stage events with simulated timing, so the UI is built against the real shape. (See Pitfall 9.)

**Warning signs:**
- Real responses faster than UI animation = UI stuck on a stage that already finished.
- "Transcribing…" message shown for a captioned video (no transcription happened).
- Users mention the loading screen is "fake" or "performative."

**Phase to address:**
**Phase 1 UI build (mock pipeline).** Design the loading contract as streaming events from day 1, even on top of mock data. Saves the rewrite when real backend lands.

---

### Pitfall 8: Cold-start + Whisper-fallback = 30-second first-paint on uncached videos

**What goes wrong:**
First user of the day hits the demo. Vercel function is cold — 1–3s spin-up. Caption pull fails (uncaptioned video) → yt-dlp downloads audio (~5–10s for a 15-min video) → Whisper transcription (~15–30s on a 15-min audio file) → LLM call (~3–5s). Total: 25–50s with the user staring at a spinner.

For a "premium" product, that's a problem even with good loading-state UX. Many users will leave.

**Severity:** Moderate. Multi-day detour to fix architecturally; can ship with worse UX and improve.

**How to avoid:**
- **Edge runtime for the API gateway, Node (or off-Vercel worker) for the heavy lift.** Edge functions have ~0ms cold starts. Use them for: accepting the URL, hitting cache, hitting captions endpoint, returning early on cache hit. Use Node (or a dedicated worker) only for the audio-fallback path.
- **Captions-first short-circuit handles cold-start when captions exist.** Edge function + cache + captions = response in <2s. Most YouTube workout videos have auto-captions. This is the same lever that helps cost (Pitfall 3).
- **Streaming response over `await`.** Even a 25s pipeline feels fast if the first event arrives in <1s and stages stream in. Vercel functions stream natively. Make the API emit events the moment work starts.
- **Aggressively cache by `youtube_id`.** Second user on same video = instant. Workout videos are shareable. Cache hit-rate compounds over time.
- **Vercel Fluid Compute / Pro plan if needed.** Fluid keeps instances warm. Hobby plan times out at 60s; Pro at 300s — non-negotiable for the Whisper-fallback path. Either commit to Pro on day one, or design so the long-running path is *not* on Vercel functions.
- **maxDuration setting.** `export const maxDuration = 60` on Hobby / 300 on Pro. Forgetting this defaults to the 10s limit and kills long extractions silently.

**Warning signs:**
- p50 response time > 10s in production.
- Vercel logs show timeouts (`FUNCTION_INVOCATION_TIMEOUT`).
- Cold-start metric (TTFB) > 3s consistently.

**Phase to address:**
**The real-pipeline phase.** Design the architecture (Edge gateway + worker offload + streaming + cache) into the first real-backend PR, not as later optimization.

---

### Pitfall 9: Mock-to-real swap reveals contract drift, timing mismatch, and shape gaps

**What goes wrong:**
The mock `/api/extract` returns a fixture JSON after 3s. The UI is polished, demo-ready. The real pipeline lands. Three failures stack up:

1. **Shape drift.** Mock fixture had `exercise.name: string`; real LLM sometimes returns `null` when confidence is low (because of Pitfall 2 mitigation). UI didn't handle `null` — blank cards or React errors in production.
2. **Timing drift.** Mock is a uniform 3s. Real responses range from 800ms (cached, captioned) to 35s (Whisper fallback). UI animations tuned to 3s look wrong on both ends.
3. **Loading contract drift.** Mock cycles fake stage messages on the client. Real backend streams events. Frontend re-write needed.
4. **Error-state drift.** Mock always succeeds. Real backend has many failure modes: 403 from YouTube, empty transcript, no exercises extracted, rate-limit hit, daily cap reached, malformed URL. Each needs distinct UI copy. Often discovered one-by-one in production.

This is the classic mock-first failure mode: contract drift plagues a documented majority of API failures in production *despite passing CI checks*.

**Severity:** Moderate — multi-day detour during the swap if not anticipated; cheap if the mock is built right.

**How to avoid:**
- **The JSON schema is the contract — make it a TypeScript Zod schema, shared by mock and real.** Both code paths import the same schema; tests validate that mock fixtures conform. When the schema changes, both update together. (`zod`, `@hono/zod-openapi`, or similar.)
- **Mock fixtures cover the failure cases too.** Build at least: happy-path fixture, low-confidence fixture (some `null` fields, `extraction_confidence: "low"`), no-exercises fixture, error-state fixtures (yt-dlp failed, transcript empty, rate-limited, daily-cap-hit). Drive the empty/error UI off these from day one.
- **Mock the streaming contract, not just the final response.** The mock should emit the same `{ stage: ... }` events the real one will. Frontend builds against streaming from day 1.
- **Variable mock timing.** Make the mock delay configurable per fixture, with an option for "slow" (20s simulated Whisper path) and "fast" (1s captioned path). Frontend tests both at 2s and 25s before real backend lands.
- **A single dev flag to swap mock ↔ real on the same UI.** `EXTRACT_BACKEND=mock|real`. Lets you test the polished UI against either without a code branch.

**Warning signs:**
- Real-pipeline fields appear that aren't in the fixture (or vice versa).
- TypeScript compiles but runtime errors on `undefined`/`null` fields.
- Real responses faster or slower than the UI was built to handle.
- Error states discovered one-by-one in production.

**Phase to address:**
**Phase 1 (mock build) sets up the schema-shared-with-real architecture and the failure-state fixtures.** Phase that ships real pipeline does the swap. Both phases should be able to point at the same UI.

---

### Pitfall 10: Legal exposure — yt-dlp + creator content + public demo

**What goes wrong:**
A creator finds their video being "extracted" by your demo. They send a DMCA notice to your hosting provider, social platforms, or open a complaint. Worse: a creator or rights holder files a small-claims action. In 2026 a federal court ruling held that YouTube's rolling cipher qualifies as DMCA-protected access control even though videos are freely viewable — bypassing it is potentially a §1201 anti-circumvention violation. Historically enforcement targeted *tools and platforms*, not individual users — and your demo *is* a platform.

This is **not legal advice** and the risk profile is genuinely unsettled, but here are the landmines:

1. **§1201 anti-circumvention.** The January 2026 California magistrate ruling created new exposure for tools that bypass YouTube's player. yt-dlp does this. A free public demo using yt-dlp server-side has more exposure than a desktop tool a user runs locally.
2. **YouTube ToS violation.** Crystal-clear: "may not access, reproduce, download…" The ToS isn't criminal law, but it's grounds for account termination, takedown requests, and a credible "stop or we sue" letter.
3. **Whisper + copyrighted content.** Sending creator audio to OpenAI for transcription could be characterized as reproduction/distribution. Whisper API ToS allows it for your own audio; creator audio is murkier.
4. **Creator complaints, not lawsuits, are the realistic outcome.** Brand risk and platform takedown notices are more likely than litigation, but they're enough to derail a demo.

**Severity:** Moderate-to-high uncertainty. Project-killer if a takedown lands. Multi-day detour minimum. Genuinely *should* talk to a lawyer before going public.

**How to avoid (not legal advice — landmine identification only):**
- **Frame the product as a personal-use demo, not a service.** Anonymous, no accounts, no saving, no monetization — already the v1 plan, lean into it. This is the same posture youtube-dl took when GitHub reinstated it.
- **Don't store creator audio or transcripts longer than needed.** Process → return → discard. Caching the *structured workout JSON* (transformative, not the original work) is meaningfully different from caching transcripts/audio.
- **Don't redistribute the original content.** No video playback, no audio download, no transcript-as-text view. Output is the structured workout, which is a transformation.
- **Add a DMCA / takedown contact page from day one.** A single page with `dmca@yourdomain` and a takedown form. If a notice arrives, you have a documented response path. This is cheap insurance.
- **Don't market against specific creators or channels.** "Extract any Jeff Nippard workout" = bullseye. "Paste any YouTube workout URL" = generic tool, much lower profile.
- **Respect `robots.txt` / DNT-style signals if practical.** Mostly performative for video, but adds defensibility.
- **Talk to a lawyer before scaling beyond a demo.** v1 is fine to ship as a hobby/portfolio project; monetization changes the risk math.

**Warning signs:**
- Inbound from rights holders or platforms.
- Mentions in creator communities ("this site is ripping our videos").
- Vercel / OpenAI ToS complaints.
- Traffic spike from an unexpected source (creator-driven outrage).

**Phase to address:**
**Phase 0 / project-setup phase.** Add a DMCA contact, a short ToS/disclaimer page, and frame the landing-page copy carefully *before* the demo is public. Cheap and prevents most realistic bad outcomes. Real legal review before any monetization or scaling phase.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip Zod (or equivalent) — TS types only | Faster prototype | Mock/real contract drift; runtime crashes on unexpected LLM output (Pitfall 9) | **Never in v1** — schema *is* the mock/real contract; cost to add later is high |
| Skip rate limiting "for the demo" | Ship faster | Bill blow-up (Pitfall 3); embarrassing post-mortem | **Never** once a real OpenAI key is deployed |
| Pin yt-dlp version, no auto-update | Stable deploys | Silent breakage within weeks (Pitfall 4) | Acceptable only with a daily smoke test running |
| Client-side fake loading states | Polished demo from day 1 | UI feels fake or stalls on real timing (Pitfall 7) | OK if streaming contract is planned for the swap, *not* a permanent shortcut |
| Single fixture, happy-path only | Faster Phase 1 | Error/empty/low-confidence UI not built; discovered in prod (Pitfall 9) | **Never** — multi-fixture cost is one afternoon, payoff is huge |
| yt-dlp on Vercel "we'll see if it works" | One less moving part | Project-killer detour mid-build (Pitfall 1) | Only if a 30-min spike has confirmed it works on Vercel's IPs *and* a fallback worker plan exists |
| One global LLM prompt, no eval set | Fast first integration | Hallucinations discovered by users (Pitfall 2) | **Never** for a "premium accuracy" product — eval set is ~1 day to build |
| Cache nothing | Simpler v1 | Cost scales linearly with traffic; cold start every time (Pitfalls 3, 8) | OK in the first day of integration; ship caching before public launch |
| Whisper-everything (skip captions check) | One code path | 100× cost on captioned videos; slower (Pitfalls 3, 8) | **Never** — captions check is one library call |
| No OpenAI dashboard budget cap | One less config | $1500 invoice from an abuse loop (Pitfall 3) | **Never** — it's a checkbox in the OpenAI dashboard |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| yt-dlp on Vercel | Assume it just works because it works locally | Spike on Vercel's IPs first; plan offload to worker; default to captions-first path |
| YouTube captions | Treating yt-dlp's caption output as canonical | Use `youtube-transcript-plus` or Innertube directly; don't go through yt-dlp/ffmpeg if captions exist |
| Whisper API | Sending audio without size/duration check | Cap at 25 MB and ~30 min; reject earlier in pipeline to save cost |
| Whisper API | One-shot send of long audio | Chunk at silence points with VAD or ffmpeg `-f segment` at ~600s; concatenate transcripts |
| OpenAI Structured Outputs | `strict: true` without nullable optional fields | Mark every optional field nullable; LLM returns `null` instead of inventing values |
| OpenAI Structured Outputs | Believing "structured" means "correct" | Schema enforces *shape*, not *truthfulness*; still need transcript-evidence round-trip + eval set |
| Upstash Ratelimit | Rate-limiting in the function (cold-start + cost incurred) | Rate-limit at edge middleware *before* the function spins up |
| Vercel Functions | Forgetting `maxDuration` | Set explicitly (`export const maxDuration = 60`); default kills long pipelines silently |
| Vercel Edge runtime | Trying to run yt-dlp/ffmpeg from Edge | Edge has no Node APIs / no binary execution; Edge for gateway only, Node (or worker) for heavy lift |
| Spend caps | Setting them in only one place | Need both Vercel Spend Management *and* OpenAI usage limit; they protect different failure modes |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Whisper on every video (no captions check) | High latency, high cost, IP-rep risk | Captions-first short-circuit | First viral moment — costs scale linearly per request |
| No caching by `youtube_id` | Same URL re-processed each time | Redis/Upstash KV cache keyed by video ID; TTL ~30 days | The first shared/viral video — cost spike from repeat hits |
| Cold-start on every extraction | High p99 latency | Edge gateway + warm worker for fallback path | Always perceptible; gets worse under bursty traffic |
| Synchronous Whisper-then-LLM (await chain) | UI stuck on spinner 30s | Stream stage events from server | Visible from request #1 |
| Large fixture imports in client bundle | Slow first paint | Server-side fixtures only; client gets responses, not fixtures | Compounds as fixtures grow |
| ffmpeg in tmp without cleanup | Function fails on subsequent invocations | Cleanup tmp on every code path; Lambda tmp is 512 MB | Within a few requests on the same warm instance |
| Long videos saturating function memory/time | Timeouts (`FUNCTION_INVOCATION_TIMEOUT`) | Pre-check duration; refuse > 30 min videos | Discovered on the first long-content edge case |

## Security Mistakes

Domain-specific risks beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| OpenAI/Whisper API key in client bundle | Catastrophic — anyone can drain your account | Server-only env vars; verify in production build (no `NEXT_PUBLIC_` prefix on secrets) |
| No URL validation before yt-dlp | SSRF / command injection / `file://` URLs | Strict regex match for `youtube.com` / `youtu.be` patterns; reject anything else at the API boundary |
| Passing user URL directly to yt-dlp shell | Command injection if shell mode used | Use yt-dlp via subprocess with arg array, never shell string; or use a Node yt-dlp wrapper |
| Cookies / PO Tokens checked into git | Account ban + creds leaked | `.gitignore` cookie files; load from env or secret manager only |
| Storing creator transcripts permanently | Copyright exposure (Pitfall 10) | Cache structured workout JSON (transformative) not raw transcript/audio |
| User IP logged indefinitely | Privacy concern for anonymous v1 | Hash IPs for rate-limit keys; don't store raw IPs beyond rate-limit TTL |
| No PII redaction in error logs | Logs leak creator/user identifiers | Scrub URLs, IPs from error payloads sent to Sentry / monitoring |
| OpenAI prompt-injection from transcript | LLM follows attacker instructions in video | Treat transcript as data, not instructions; use system prompt to ignore embedded instructions in user content |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Confident wrong output on low-confidence extraction | Trust collapse on first "I never said that" moment | Surface `extraction_confidence`; show "best-effort" badge on low-confidence; offer to retry or report |
| Generic "extraction failed" error | User has no idea what to do | Distinct copy per failure mode (no captions, video too long, rate-limited, unsupported content type) |
| Fake cycling loading messages | Feels theatrical when real pipeline is fast (Pitfall 7) | Stream real stage events; minimum 300ms dwell for polish |
| 30s wait with no progress indication | User leaves before completion | Skeleton workout card visible immediately; stage events stream into it |
| No retry on failure | User must re-paste URL | One-click retry button on error states |
| URL input doesn't accept `youtu.be` short links | Half of share-from-mobile URLs fail | Accept all canonical YouTube URL forms; normalize server-side |
| No example URLs on landing | "What kind of video should I paste?" friction | Show 3 known-good example URLs as click-to-try chips |
| Daily-cap-hit silently fails | User retries thinking it's their fault | Explicit "daily demo quota reached; come back tomorrow" message |
| Glassmorphism cards lost against flat dark bg (Pitfall 6) | UI looks broken, not premium | Ambient gradient background; boost panel opacity for dark variant |
| Dark-mode default with no toggle | Accessibility — users with light-sensitive eyes prefer light | Optional, but the brief locks dark; at minimum, ensure WCAG contrast |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces. Run this before each phase transition.

- [ ] **`/api/extract` mock:** Often missing failure-state fixtures — verify low-confidence, no-exercises, and error fixtures exist and the UI handles each.
- [ ] **`/api/extract` real:** Often missing rate-limit, daily-cap, and OpenAI budget cap — verify all three are configured *before* the real key deploys.
- [ ] **JSON schema:** Often defined in TS types only — verify it's a runtime-validated schema (Zod or equivalent) shared by mock and real.
- [ ] **Loading state:** Often hardcoded cycling on client — verify stage events stream from the server and the client reacts to them.
- [ ] **Extraction success:** Often defined as "200 response" — verify `exercises.length > 0` and `extraction_confidence` are checked; empty extractions surface as failure UX.
- [ ] **yt-dlp / video fetch:** Often working locally only — verify on the actual deploy target (Vercel or worker); test 3+ real URLs.
- [ ] **Cost protections:** Often "we'll add rate limits later" — verify rate-limit + daily-cap + OpenAI budget cap *and* spend management are all live before public link is shared.
- [ ] **Dark-mode UI:** Often glassmorphism cards on flat bg — verify ambient gradient background + WCAG contrast pass for all text.
- [ ] **Error UX:** Often a single "Something went wrong" — verify distinct copy for: no captions, IP block, daily cap, rate limit, video too long, malformed URL, LLM low-confidence.
- [ ] **Empty state:** Often missing entirely — verify the "no workout extracted" state has design + copy, not just blank.
- [ ] **Smoke test:** Often missing — verify a daily probe hits 3 known-good URLs and alerts on regression.
- [ ] **Legal cover:** Often skipped — verify DMCA contact page exists, no transcript/audio is stored, no specific creators are marketed against.
- [ ] **Caching:** Often forgotten — verify `youtube_id` cache returns the second call instantly without re-incurring cost.
- [ ] **Captions-first short-circuit:** Often missed — verify a captioned video does *not* invoke Whisper.
- [ ] **maxDuration:** Often defaulted — verify `export const maxDuration` is set on the heavy function explicitly.

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| yt-dlp blocked on Vercel IPs | HIGH | (1) Disable affected routes / show maintenance state. (2) Stand up worker on Modal/Fly/Railway with PO Token + cookies. (3) Update API to proxy to worker. (4) Re-enable. Plan: 1–3 days. |
| LLM hallucinations in shipped output | MEDIUM | (1) Add transcript-evidence validation + re-prompt on mismatch as hotfix. (2) Tighten system prompt with explicit "do not invent" + nullable fields. (3) Build eval set from production failures. (4) Surface confidence in UI. Plan: 1–2 days. |
| Bill blow-up (OpenAI / Vercel) | HIGH (money) | (1) Immediately set hard OpenAI usage cap and rotate the API key. (2) Disable `/api/extract` until rate-limit + daily-cap are in. (3) Document the incident for OpenAI billing dispute (they sometimes credit demonstrably abuse-driven overages — sometimes). (4) Add caching. Plan: hours to disable, 1 day to harden. |
| yt-dlp silently broken | LOW (if monitoring catches it) / MEDIUM (if users find it first) | (1) Update yt-dlp + PO Token provider. (2) Run smoke test. (3) Investigate root cause (YouTube player update? cookie expiry?). (4) Document for next occurrence. Plan: hours. |
| Mock/real contract drift discovered late | MEDIUM | (1) Generate Zod schema from current real responses. (2) Run against fixtures, fix divergences. (3) Add to CI to prevent regression. Plan: 1 day. |
| Glassmorphism looking cheap | LOW (if caught early) / MEDIUM (if post-launch) | (1) Add ambient gradient background layer. (2) Boost card opacity / add scrim. (3) Audit contrast with axe. (4) Cut excess motion. Plan: 1 day if scoped tightly. |
| Loading state mismatch | LOW | (1) Convert mock to emit streamed events. (2) Wire UI to events not timers. (3) Add minimum dwell per stage. Plan: half a day. |
| DMCA / takedown notice | MEDIUM-HIGH | (1) Take down the demo immediately. (2) Respond per the notice's instructions. (3) Document a takedown policy. (4) Consult a lawyer before relaunching. Plan: days, possibly weeks. |
| Transcript fidelity complaints | LOW-MEDIUM | (1) Add example-URLs to landing page (steer users to known-good content). (2) Add "best-effort" badge for low-confidence. (3) Improve prompt + slang glossary. Plan: 1–2 days. |
| Vercel cold-start drag | LOW-MEDIUM | (1) Move gateway to Edge runtime. (2) Add caching. (3) Captions-first short-circuit (if not already). (4) Consider Vercel Pro for Fluid Compute. Plan: 1 day. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 yt-dlp on Vercel blocked | **Phase 0/1 spike** (before architecture locks) | A deployed Vercel function calls yt-dlp on 3 YouTube URLs from production; if 2+ fail, architecture pivots to worker offload before UI work commits to the assumption |
| #2 LLM hallucination | **Real-pipeline phase** (mock → real swap) | Eval set of 5–10 hand-labeled videos including 1 non-fitness control; transcript-evidence validation passes; `nullable` strict-mode schema in place |
| #3 Cost explosion | **Real-pipeline phase** (must ship with first real key) | Rate limit + daily cap + caching + URL allow-list + OpenAI budget cap + Vercel Spend Management *all* live before public link |
| #4 yt-dlp version churn | **Real-pipeline phase** (operational hardening) | Daily smoke test runs against known-good URLs; alerts on extraction-success regression |
| #5 Transcript fidelity | **Real-pipeline phase + landing-page phase** | `extraction_confidence` is in the schema and UI; landing page shows example URLs; empty-state UX for unsupported content exists |
| #6 Glassmorphism done badly | **Phase 1 UI build** | WCAG contrast passes; ambient gradient bg present; designer review against "premium" reference set |
| #7 Fake loading states | **Phase 1 UI build** (streaming contract designed from day 1) | Mock emits stage events; UI reacts to events not timers; works correctly at 800ms and 25s simulated timing |
| #8 Cold starts + Whisper latency | **Real-pipeline phase (architecture)** | Edge gateway + worker offload + cache + streaming all in first real PR; p50 < 5s, p95 < 30s |
| #9 Mock/real swap pain | **Phase 1 (mock setup) + real-pipeline phase** | Shared Zod schema across mock/real; failure-state fixtures exist; streaming contract mocked; one-flag swap |
| #10 Legal exposure | **Phase 0 (project setup)** | DMCA contact page exists; ToS/disclaimer drafted; no creator-specific marketing; no transcript/audio retention |

## Sources

**yt-dlp / YouTube serverless reliability:**
- [yt-dlp issue #10128: Sign in to confirm you're not a bot](https://github.com/yt-dlp/yt-dlp/issues/10128) — primary upstream tracking issue
- [yt-dlp issue #15800: YouTube blocks downloads](https://github.com/yt-dlp/yt-dlp/issues/15800) — recent (2026) breakage discussion
- [yt-dlp issue #15899: fragment-retries triggers YouTube IP ban](https://github.com/yt-dlp/yt-dlp/issues/15899)
- [yt-dlp PO Token Guide (wiki)](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) — current authentication state of play
- [yt-dlp YouTube Authentication wiki](https://deepwiki.com/yt-dlp/yt-dlp-wiki/3.2-youtube-authentication)
- [How to Tackle yt-dlp Challenges in AI-Scale Scraping](https://medium.com/@DataBeacon/how-to-tackle-yt-dlp-challenges-in-ai-scale-scraping-8b78242fedf0)
- [Fix yt_dlp Sign in Error on Cloud Hosts](https://www.technetexperts.com/fix-yt-dlp-cloud-signin-error/)
- [Yozora — yt-dlp on Vercel reference implementation](https://github.com/ectora/yozora)
- [AWS Lambda Limits](https://blog.thundra.io/aws-lambda-limits-to-keep-in-mind-when-developing-a-serverless-application) — binary / tmp size constraints
- [ffmpeg AWS Lambda Layer](https://github.com/serverlesspub/ffmpeg-aws-lambda-layer)

**LLM structured output / hallucination:**
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — primary source; nullable fields and hallucination caveat
- [OpenAI community: Strict mode does not enforce the JSON schema?](https://community.openai.com/t/strict-mode-does-not-enforce-the-json-schema/1104630)
- [Guide to structured outputs and function calling](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Hevy + Gemini structured workout extraction (n8n template)](https://n8n.io/workflows/6527-convert-workout-plan-pdfs-to-hevy-app-routines-with-gemini-ai/) — closed-enum exercise list pattern

**Whisper / transcription:**
- [OpenAI Whisper pricing — $0.006/min](https://tokenmix.ai/blog/whisper-api-pricing)
- [Whisper 25MB chunking with ffmpeg](https://community.openai.com/t/whisper-api-how-to-upload-file-that-larger-than-25mb/693285)
- [Audio chunking for long-form transcription](https://dev.to/nareshipme/audio-chunking-for-long-form-transcription-splitting-and-stitching-with-ffmpeg-typescript-4amk)
- [youtube-transcript-plus (Node lib)](https://github.com/ericmmartin/youtube-transcript-plus) — caption-first short-circuit
- [Supadata YouTube Transcript API (with AI fallback)](https://supadata.ai/blog/best-youtube-transcript-api)

**Rate limiting / cost protection:**
- [Vercel + Upstash IP rate limit template](https://vercel.com/templates/next.js/api-rate-limit-and-tokens)
- [Vercel Limit Abuse with Rate Limiting (KB)](https://vercel.com/kb/guide/limit-abuse-with-rate-limiting)
- [Upstash edge rate limiting blog](https://upstash.com/blog/edge-rate-limiting)
- [Vercel Pricing — Spend Management defaults](https://vercel.com/pricing)
- [Vercel pricing: real numbers and overruns](https://deploywise.dev/blog/vercel-pricing-explained)
- [Vercel community: Hobby plan exceeded by AI bot crawling](https://community.vercel.com/t/hobby-plan-usage-limits-exceeded-due-to-ai-bot-crawling/41718)

**Vercel runtime / cold start:**
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Edge Runtime](https://vercel.com/docs/functions/runtimes/edge)
- [Vercel maxDuration config](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Fluid Compute](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)
- [Vercel cold-start performance KB](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)

**Worker / off-Vercel options:**
- [Modal (Python-native AI workload platform)](https://modal.com/)
- [Vercel Functions vs Fly.io vs Railway](https://thesoftwarescout.com/fly-io-vs-railway-2026-which-developer-platform-should-you-deploy-on/)

**UX patterns:**
- [AI Loading States Pattern](https://uxpatterns.dev/patterns/ai-intelligence/ai-loading-states)
- [Skeleton screens vs spinners (NN/g)](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/)
- [Death to the loading spinner — streaming AI UIs](https://devm.io/react/death-to-the-loading-spinner-mastering-streaming-ai-uis-in-react)
- [Skeleton loading screen design (LogRocket)](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/)

**Dark mode / glassmorphism:**
- [Dark Glassmorphism: The Aesthetic Defining UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [12 Glassmorphism UI Features, Best Practices, and Examples](https://uxpilot.ai/blogs/glassmorphism-ui)
- [Glassmorphism in UI Design: A Design System Approach](https://digitalthriveai.com/en-us/resources/web-design/glassmorphism/)
- [Dark Mode UI: Best Practices for 2025](https://www.graphiceagle.com/dark-mode-ui/)

**Mock/real contract drift:**
- [Automated Contract Testing: Detecting API Drift](https://medium.com/@instatunnel/automated-contract-testing-how-to-detect-api-drift-before-it-reaches-production-6c2a77baa2a3)
- [When Swagger Lies: Fixing API Drift](https://dev.to/copyleftdev/title-when-swagger-lies-fixing-api-drift-before-it-breaks-you-ijo)
- [WireMock Contract Testing for Mock APIs](https://www.wiremock.io/post/new-module-in-wiremock-cloud-contract-testing-for-mock-apis)

**Legal / ToS:**
- [Is It Legal to Download YouTube Videos? 2026 DMCA Explained](https://bestvideodownloader.net/is-it-legal-to-download-youtube-videos-2026-dmca-explained/)
- [How third-party YouTube downloads create copyright risks](https://www.medianama.com/2026/02/223-dmca-ruling-third-party-youtube-downloads-legal-risks-creators/)
- [Is downloading YouTube videos illegal? Laws & risks](https://legalclarity.org/is-downloading-youtube-videos-illegal/)
- [YouTube DMCA 2025: Takedowns, Strikes & Creator Rights](https://dmcadesk.com/blogs/youtube-dmca-takedowns/)

---
*Pitfalls research for: AI-powered workout-extraction web app (Next.js + Vercel + yt-dlp + Whisper + LLM)*
*Researched: 2026-05-16*
