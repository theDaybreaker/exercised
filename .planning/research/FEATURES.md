# Feature Research

**Domain:** AI-powered workout-extraction web app (YouTube URL → structured workout view)
**Researched:** 2026-05-16
**Confidence:** MEDIUM-HIGH (high for general AI-tool patterns and fitness-app UX; medium-low for direct competitors — this exact niche has surprisingly few head-to-head products)

## Research Context

This is a v1, anonymous-only, view-only web app. No accounts, no save, no active workout tracking. The product is judged on two things: (1) extraction quality and (2) how *premium* the output feels. Every feature below is filtered through that lens. Features that quietly require auth, persistence, or a tracker are flagged and pushed out.

The closest analogues are two distinct product categories that we are mashing together:

1. **AI YouTube summarizers** (Glasp, Eightify, Heuristica, Side Copilot, NoteGPT) — solve URL-paste, transcript fetch, AI structuring, no-login UX, share-link patterns. Visited and synthesized below.
2. **Premium fitness apps** (Hevy, FitNotes, Reps & Sets, AnyDistance, WorkoutGen) — solve exercise-card UX, muscle group visualization, rest timers, dark-mode aesthetic. Visited and synthesized below.

No product was found that does both well. **That gap is the differentiation surface.**

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and the product reads as half-finished even if extraction is great.

| Feature | Why Expected | Complexity | v1-Safe? | Notes |
|---------|--------------|------------|----------|-------|
| Prominent URL input field above the fold | Every paste-a-link AI tool puts this front-and-center (Glasp, Heuristica, NoteGPT, Side Copilot all do). Hunting for the input = product fail. | LOW | Yes | Already in PROJECT.md Active reqs. |
| Client-side YouTube URL validation before submit | Industry baseline. Stops dumb backend round-trips (= cost) and gives instant feedback. Validate `youtube.com/watch`, `youtu.be/`, `youtube.com/shorts` formats. | LOW | Yes | Pure regex. Don't hit `/api/extract` until URL parses. |
| Auto-paste from clipboard on focus *(opt-in, not silent)* | When user lands on the page with a URL on their clipboard, surfacing a "Paste from clipboard" affordance is a real premium-tool tell. **Do not silently auto-fill** — `navigator.clipboard.readText()` is permission-gated and creepy when invisible. Pattern: show a small "Paste" button next to the input, or detect on focus and prompt. | LOW | Yes | `navigator.clipboard.readText()` — requires user gesture in most browsers. |
| Loading state that explains *what's happening* (not just a spinner) | Pipeline takes 10s-2min realistically (yt-dlp + Whisper + LLM). Bare spinner at >3s = users assume broken. PROJECT.md already lists cycling "Fetching → Transcribing → Analyzing → Generating" as a req — that pattern is industry-correct (see Differentiators for the nuance). | MEDIUM | Yes | Below: pattern is correct, *cliché only if faked*. |
| Failure / empty / no-workout-detected error state | The single most-overlooked UI state. AI scaffolds default to happy-path. A clear "we couldn't find workout content in this video — here's why" message with a recovery action is table stakes for any AI tool in 2026. | LOW | Yes | Already in PROJECT.md Active reqs. |
| Link to source video + creator credit on output | Trust signal #1 for AI-extracted content. Every YouTube summarizer does this. Lets the user verify, and is also a courtesy/legal posture toward creators. | LOW | Yes | Just embed the watch URL and channel name. |
| Workout meta block (title, creator, duration, target muscles) | The "hero card" of the output. Every summarizer leads with title/source/length; fitness apps lead with target muscles. Both apply here. | LOW | Yes | In PROJECT.md Active reqs. |
| Exercise cards with sets/reps/rest/form cues | The product. No need to justify. | MEDIUM | Yes | In PROJECT.md Active reqs. |
| Superset visual grouping | Common workout structure; flat-listing them is a *correctness* failure, not a polish failure. A trainer-watching user will spot a missing superset immediately and dismiss the product. | MEDIUM | Yes | In PROJECT.md Active reqs. Render as a bracketed/grouped card per brief. |
| Copy-to-clipboard for the workout | Lowest-friction "save" mechanism. No auth, no PDF complexity. Copies clean text (markdown or plain) so users can paste into Notes, Notion, etc. Should be one button, one click. | LOW | Yes | Plain text + markdown variant. Use `navigator.clipboard.writeText()`. |
| Mobile-responsive output | Half of all users will paste from their phone in or near a gym. Cards must stack, type must scale, hit targets must be thumb-sized. | MEDIUM | Yes | Tailwind handles this — *if it's tested on mobile from Phase 1, not retrofitted.* |
| Rate limiting + clear "slow down" error | Already in PROJECT.md as a backend requirement, but the *UX* of it is table stakes too. "You've reached the limit, try again in N minutes" with a friendly tone, not a 429 dump. | LOW | Yes | Server-side rate limit, client-side error component. |

### Differentiators (Competitive Advantage)

This is where the project wins or loses. The brief specifies "premium" — these are the features that earn that label.

| Feature | Value Proposition | Complexity | v1-Safe? | Notes |
|---------|-------------------|------------|----------|-------|
| **Honest, *real* pipeline status** (cycling stages tied to actual backend events) | The "Fetching → Transcribing → Analyzing → Generating" pattern is industry-correct *but becoming a cliché when faked.* A timed carousel of fake stages is a tell. The differentiator is making each stage transition fire from a *real* server event (SSE / streaming response / status polling). That's the difference between a premium AI tool and a vibe-coded one. **Recommendation:** ship real stages from day one; if the pipeline isn't streaming yet, at least drive transitions from server checkpoints, not `setTimeout`. | MEDIUM | Yes (need streaming API or status polling) | UX research is converging on: nondeterministic loading needs *context, not progress*. Cycling steps are fine. Faking them is the cliché — not the pattern itself. |
| **Jump-to-timestamp links on each exercise card** | This is the single highest-leverage trust feature. Each exercise card has a "↪ 2:14 in video" button that opens YouTube at that timestamp. Users instantly verify form cues against the source. Closes the trust loop on AI extraction. This is what every premium YouTube-AI tool does (VideoToWisdom, MyLens, WayinVideo). | MEDIUM | Yes | Requires the LLM extraction to emit per-exercise `startTimestamp` (seconds). Already implied by the AI pipeline — just bake it into the schema NOW. |
| **Muscle group pill tags with anatomy mini-diagram** | Pill tags are table stakes. A tiny anatomy silhouette in the hero showing *which* muscles light up, in the dark-mode neon palette, is a high-impact polish win. Hevy does this. AnyDistance does similar. It's the kind of detail that says "premium fitness app" without saying anything. | MEDIUM | Yes | Use a static SVG silhouette and tint highlighted muscles. Don't build an interactive 3D model — too much. |
| **One-click "Share this workout" with URL-encoded state** | Solves "save without auth" for free. Workout JSON → base64/lz-string encode → query param → recipient hits the URL and renders the workout *without re-running the AI pipeline*. Costs $0, no backend, no DB, no auth. Critical caveat below in dependencies. | MEDIUM | Yes — *this is the killer no-auth feature* | Compression matters (`lz-string` keeps URLs under realistic length limits). For very long workouts, fall back to a server-stored short link — but that needs storage, so defer that fallback. URL approach is genuinely sufficient for a 10-exercise workout. |
| **"Open in Notes" / "Add to Apple Reminders" / Calendar export** | Lightweight personal-save without an account. iCal `.ics` file with the workout as event description = a real, native-feeling save. Most fitness apps skip this. | MEDIUM | Yes | `.ics` files are dead simple; no server needed. Lower priority than copy/share. |
| **Inline "edit before share/copy" affordance** | The user sees `5x5 Bench Press` and the LLM heard "5 by 5" and parsed wrong, or rest was "60-90 seconds" and got rendered as "60s". A premium-feeling AI tool lets the user tap a value, fix it, and re-copy/re-share. Trust + utility. | MEDIUM-HIGH | Yes (client-side state only, no persistence) | Be careful: full edit mode is scope creep toward a workout builder. Keep it to inline edit of numeric fields and short text — *not* add/remove exercises. |
| **Exercise difficulty / experience-level indicator** | LLM can classify each exercise as beginner / intermediate / advanced from the cues and equipment. A subtle dot or chip on the card. Helps a viewer triage "can I actually do this video?" without watching. Differentiator vs. raw transcript summarizers. | LOW-MEDIUM | Yes | LLM-prompted output field. Free-ish to add. |
| **Equipment chips on hero** ("Dumbbells, Bench, Mat") | Decision-relevant before the user commits to the workout. Standard on workout apps, almost never on AI-summarizer apps — easy win at the intersection. | LOW | Yes | Extract in the same LLM call. |
| **Premium dark/glassmorphism aesthetic with motion** | PROJECT.md locks this. Industry trend research (Dribbble, AnyDistance, dark-glassmorphism articles) confirms this is the dominant 2025-26 fitness aesthetic. Done well, this alone differentiates from text-heavy YouTube summarizers. | MEDIUM-HIGH | Yes | Already in scope. Test on mobile — glassmorphism can chug on lower-end devices. |
| **"Why we extracted this" subtle confidence affordance per exercise** | Hover/tap an exercise → small popover with the transcript snippet that produced it (e.g., "0:42 — *'we're gonna do 3 sets of 12 here'*"). This is the academic-grade trust pattern: source visibility on demand, not in your face. Research note: *low*-confidence indicators reduce trust; *high*-confidence indicators are neutral. So don't show "85% confident" badges. Show the *evidence*, let the user judge. | MEDIUM | Yes | Requires the LLM to emit `sourceQuote` + timestamp per exercise. Schema decision needed early. |
| **Skeleton cards during loading** (instead of just a spinner) | Show ghost exercise cards in the same layout while loading. Reduces perceived wait, signals "the output will look like this". Combined with the pipeline status, far more premium than a centered spinner. | LOW | Yes | Tailwind animate-pulse + the real card components rendered with skeleton data. |
| **PDF export (lightweight, print-styled)** | "I want to take this to the gym on paper" is a real user behavior. A clean print stylesheet + `window.print()` is essentially free; a server-side PDF render is over-engineered. Print-styled web view is the right call for v1. | LOW (print CSS) / MEDIUM (server PDF) | Yes (print CSS path) | Skip server PDF in v1 — print stylesheet handles 90% of cases. |
| **Recently-extracted URLs (localStorage only)** | The user pastes a URL, gets the workout, navigates away, comes back tomorrow, the input remembers their last 3-5 URLs. Zero backend, no auth, real utility. Don't market it as "history" — that's an auth feature. | LOW | Yes (localStorage only) | Be careful re: privacy expectations — clear on demand, never sync. |

### Anti-Features (Commonly Requested, Often Problematic)

These are features that pattern-match to "fitness app" or "AI tool" but would actively harm THIS product. Stating them explicitly to prevent re-litigation.

| Anti-Feature | Why Requested | Why Problematic for v1 | Alternative |
|--------------|---------------|------------------------|-------------|
| **Forced sign-up wall before extraction** | "We need user emails to grow." Industry default for SaaS funnels. | One mediation app moved their paywall upfront and dropped conversion 40%. This product's whole value prop is "paste and view in seconds." A sign-up wall before the user has *seen the output* destroys the demo loop and contradicts the explicit PROJECT.md `anonymous in v1` decision. | If/when accounts come (v2+), gate *save/library* — never gate *extraction*. The extracted workout is the demo. |
| **Soft paywall ("3 free extractions per day, sign up for unlimited")** before product-market fit | Common monetization pattern in AI tools. | We don't yet know if extraction is *good enough* to be worth paying for. Putting a meter on a product whose quality isn't validated is putting the cart before the horse. PROJECT.md confirms `Payments / subscriptions — v1 is free demo`. | Server-side IP rate limit (already in scope) handles abuse. Don't surface it as a meter to users — it's an *abuse* control, not a *monetization* layer. |
| **In-app workout tracker / set logger / rest timer that runs** | Every fitness app has it. "We're a fitness app, right?" | This is the largest scope-creep risk in the entire roadmap. Tracking turns a viewer app into a stateful app, which needs accounts, which needs a database, which needs auth, which needs settings, which needs… PROJECT.md is unambiguous: viewable, not interactive. A rest timer alone implies "the user is using this in the gym mid-set" — a fundamentally different product. | Display rest periods as data on the card. If users want active tracking, the export-to-other-app paths handle it. Re-evaluate post-mobile. |
| **Social feed / community / "trending workouts"** | "Engagement! Retention!" The defining anti-feature of consumer apps in the 2020s. | Distracts from the core extract-and-go loop, requires accounts, requires moderation, requires a database, invites spam and copyright issues (the workouts are derived from creators' videos — a social feed of those is a legal landmine the project is not ready for). | None. Just don't. If users want to share, the share-via-URL pattern is enough. |
| **Heavy onboarding / preference survey** ("What's your goal? Experience level? Equipment?") | Personalization is the buzzword of the decade. | The user came here to extract one specific video they already chose. Asking them 5 questions first is breaking the contract. | Optional filters/personalization can live *inside* the output ("show only beginner-friendly exercises") if needed at all. Don't gate input. |
| **Generated workout images / AI-rendered exercise illustrations** | "Make it visual! Make it AI-cool!" | The closest analogues (ImagineArt, HeyGen workout video generators) make 5-second AI clips of unrealistic-looking humans doing form-incorrect exercises. This actively harms trust — the user sees "AI nonsense" and questions the extraction quality. The source video already has the real demonstration. | Link to the source timestamp instead. The actual creator's actual form is the right "illustration." If a static reference is needed for an exercise (e.g., the user is offline), use a curated icon set, not generated art. |
| **Multi-language support in v1** | "Why not Spanish/Portuguese/French?" | PROJECT.md explicitly out-of-scope. Whisper handles audio in many languages, but form-cue extraction is prompted in English and quality drops significantly on non-English LLM extraction. Half-supporting a language is worse than not supporting it. | English-only with a graceful "unsupported language" error for detected non-English content. |
| **TikTok / Instagram Reels ingestion** | "Most workout content is on TikTok now." True, but: | PROJECT.md explicitly out-of-scope. Scraping breaks weekly, Reels requires cookies or a paid scraping API. Cost + reliability problem, not a UX problem. | YouTube only. Revisit per PROJECT.md notes after extraction quality is proven. |
| **AI chatbot / "ask questions about this workout"** | The mandatory 2024-25 feature for any AI tool. | Drains the budget on a Q&A loop that's tangential to the core value. Most users don't want to chat with their workout — they want to see and use it. | If users ask "what does this exercise target?", surface that information *in the card* (already covered by muscle tags and form cues). |
| **Auto-play embedded video** | "Show, don't tell" / engagement bait. | Pulls focus from the extracted workout (which is the value), inflates page weight, autoplay video on mobile is universally hated. | Embed video as an *optional* expandable section. Default state: collapsed thumbnail with play affordance. Or just a "watch on YouTube" link. |
| **Account suggestion popups / "Create an account to save!"** mid-session | Standard growth-hack interruption. | We're explicitly anonymous-only. Adding a popup that *suggests* the missing feature is worse than not having it — it advertises the limitation while ignoring our own scope decision. The share-URL pattern *is* the save mechanism. | None. If/when accounts ship, surface them in a non-interruptive way (e.g., a persistent "Sign in to save" link in the corner, not a modal). |
| **Verbose disclaimers / liability warnings cluttering the output** | "AI may be wrong! Consult a doctor!" plastered everywhere. | A single legal disclaimer in the footer is fine and probably warranted. Banner-level warnings on every card train users to ignore them and read as "we don't trust our own product." | One footer-level "AI extraction is best-effort; verify against the source video" line, plus per-exercise source-quote affordance (already in differentiators) — that's the real trust mechanism. |

## Feature Dependencies

```
[YouTube URL validation]
    └──unblocks──> [/api/extract submit]
                        └──unblocks──> [Loading state]
                                            └──unblocks──> [Output rendering]

[LLM output schema includes startTimestamp per exercise]
    └──enables──> [Jump-to-timestamp links]
    └──enables──> [Source-quote popover (Why we extracted this)]

[LLM output schema includes muscleGroups[]]
    └──enables──> [Muscle pill tags]
    └──enables──> [Anatomy silhouette diagram]

[LLM output schema includes difficulty per exercise]
    └──enables──> [Difficulty indicator chips]

[Stable JSON schema]
    └──enables──> [URL-encoded share state]
                        └──unblocks──> [Open in Notes / iCal export]
                        └──unblocks──> [PDF / print stylesheet]
                        └──unblocks──> [Copy to clipboard (markdown)]

[Real backend streaming or status endpoint]
    └──enables──> [Honest pipeline status]
    └──prevents──> [Cliché "faked status carousel" anti-pattern]

[Skeleton cards] ──enhances──> [Loading state]
[localStorage recent URLs] ──enhances──> [URL input]

[Forced sign-up] ──conflicts──> [Anonymous v1 scope (PROJECT.md)]
[Active tracker / rest timer running] ──conflicts──> [Viewable not interactive (PROJECT.md)]
[Social feed] ──conflicts──> [Anonymous v1 + every other constraint]
```

### Dependency Notes

- **LLM output schema is the highest-leverage early decision.** Several differentiators (jump-to-timestamp, source quote, difficulty, equipment, muscle groups) all hinge on the schema emitted by the LLM call. **Decide the full schema before locking the mock fixture** — adding fields later means re-prompting, re-fixturing, and re-rendering. Schema work is in the critical path.
- **URL-encoded share state requires stable schema + compression.** If the schema changes after a share link is in the wild, those links break. Version the encoded payload (`v=1`) from day one.
- **Real pipeline status requires either Server-Sent Events, a polling endpoint, or streaming response.** This is a backend shape decision that has UX implications. If the architecture goes "fire-and-forget HTTP POST that takes 60s", the cycling status pattern *will* be fake. Discuss in ARCHITECTURE.md.
- **Skeleton cards and recent-URL history are pure client-side polish** — zero backend dependency, can ship any time after the basic UI exists.
- **Mobile responsiveness is a per-component concern, not a feature.** It should be validated in Phase 1 alongside desktop, not deferred to a "responsive pass" phase. Glassmorphism specifically needs mobile testing because `backdrop-filter` can be expensive.

## MVP Definition

### Launch With (v1)

The brutally minimal set that delivers on PROJECT.md's core value ("paste a URL → see a premium workout in seconds"):

- [x] Landing page with prominent URL input + Extract CTA *(in PROJECT.md)*
- [x] YouTube URL validation (client-side, regex) before submit
- [x] Real pipeline status (driven from backend, not faked) *(in PROJECT.md, mocked Phase 1)*
- [x] Skeleton cards during loading
- [x] Workout output: title, creator, duration, muscle pills, exercise list *(in PROJECT.md)*
- [x] Exercise cards: name, sets, reps, rest, expandable form cues *(in PROJECT.md)*
- [x] Superset visual grouping *(in PROJECT.md)*
- [x] Link to source video + per-exercise jump-to-timestamp
- [x] Copy-to-clipboard (markdown + plain text variants)
- [x] Share link via URL-encoded state
- [x] Print-styled view (`@media print` CSS, no server PDF)
- [x] Mobile responsive throughout
- [x] Error/empty state when extraction fails *(in PROJECT.md)*
- [x] Rate-limit error UX *(in PROJECT.md backend req)*
- [x] Footer-level AI disclaimer
- [x] Premium dark/glassmorphism aesthetic *(in PROJECT.md)*

### Add After Validation (v1.x)

These wait until extraction quality is confirmed and we have signal that the product is sticky.

- [ ] Source-quote popover per exercise — *trigger: users questioning extraction accuracy in feedback*
- [ ] Inline edit of numeric fields (sets/reps/rest) — *trigger: users want to share corrected versions*
- [ ] Anatomy silhouette mini-diagram — *trigger: polish phase / aesthetic upgrade pass*
- [ ] Difficulty indicators — *trigger: users want triage info before viewing*
- [ ] Equipment chips — *trigger: same as difficulty*
- [ ] Auto-paste prompt from clipboard — *trigger: small UX polish phase*
- [ ] iCal/Calendar export — *trigger: user requests for "save this for tomorrow"*
- [ ] Recently extracted URLs (localStorage) — *trigger: returning-user pattern emerges*

### Future Consideration (v2+)

Explicit alignment with PROJECT.md Out of Scope. These are roadmap-recognized but deferred.

- [ ] User accounts + saved workouts — *defer: requires auth + DB; unlock entire feature class*
- [ ] Active workout tracker (logging, weights, rest timer) — *defer: mobile-app territory, different product*
- [ ] TikTok / Instagram Reels ingestion — *defer: per PROJECT.md, fragile scraping*
- [ ] Multi-language extraction — *defer: per PROJECT.md, requires prompt re-tuning*
- [ ] Server-side PDF export — *defer: print-CSS handles v1 demand*
- [ ] Native mobile app — *defer: per PROJECT.md milestone*
- [ ] Monetization (subscription / per-extraction credits) — *defer: per PROJECT.md, validate first*

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| URL input + validation | HIGH | LOW | P1 | Critical path |
| Pipeline status (real, not faked) | HIGH | MEDIUM | P1 | Differentiator; needs backend shape decision |
| Skeleton loading cards | MEDIUM | LOW | P1 | High polish-to-effort ratio |
| Workout output (hero + cards + supersets) | HIGH | MEDIUM | P1 | The product |
| Jump-to-timestamp links | HIGH | MEDIUM | P1 | Trust + utility multiplier; needs schema field |
| Source video link + creator credit | HIGH | LOW | P1 | Trust + courtesy |
| Copy to clipboard | HIGH | LOW | P1 | Primary "save" mechanism |
| Share via URL-encoded state | HIGH | MEDIUM | P1 | The killer no-auth feature |
| Error / empty state | HIGH | LOW | P1 | Table stakes; PROJECT.md req |
| Rate-limit UX | MEDIUM | LOW | P1 | PROJECT.md req |
| Mobile responsive | HIGH | MEDIUM | P1 | Half of users are mobile |
| Print stylesheet | MEDIUM | LOW | P2 | Cheap win, defer if time pressure |
| Source-quote popover ("why we extracted this") | HIGH | MEDIUM | P2 | Powerful trust feature; schema field needed early |
| Anatomy silhouette diagram | MEDIUM | MEDIUM | P2 | Polish; high "premium" payoff |
| Inline numeric edit | MEDIUM | MEDIUM | P2 | Defer unless quality issues surface |
| Difficulty indicators | MEDIUM | LOW | P2 | Schema field cheap; UI cheap |
| Equipment chips | MEDIUM | LOW | P2 | Same as above |
| Auto-paste prompt | LOW | LOW | P3 | Pleasant but not load-bearing |
| iCal / Calendar export | LOW | MEDIUM | P3 | Niche use case |
| Recently extracted URLs (localStorage) | MEDIUM | LOW | P3 | Adds returning-user value |

**Schema-level pre-commitment (P0 — must decide before any LLM prompt is locked):**

The JSON shape returned by `/api/extract` must include, per exercise, *at minimum*:
- `startTimestamp` (seconds) — enables jump-to-timestamp
- `sourceQuote` (string) — enables source-quote popover
- `muscleGroups[]` (string[]) — enables pill tags + anatomy diagram
- `difficulty` (enum) — enables difficulty chip
- `equipment[]` (string[]) — enables equipment chips

These are nearly free to add to the prompt and fixture *now*, and expensive to retrofit later. **This is the most important call-out in this document for the roadmap.**

## Competitor Feature Analysis

| Feature | AI Summarizers (Glasp, Eightify, NoteGPT) | Fitness Apps (Hevy, FitNotes, Reps & Sets) | Our Approach |
|---------|-------------------------------------------|---------------------------------------------|--------------|
| URL paste input | Front and center, no login | N/A | Same — front and center, anonymous |
| Pipeline loading state | Cycling status / spinner with text | Determinate progress on syncs | Cycling status, *honest* (backend-driven) |
| Output format | Bullet summaries, transcripts, mind maps | Exercise cards with set/rep grids | **Hybrid** — exercise cards as primary, no flat summary |
| Source attribution / timestamps | Clickable timestamps in summary | N/A (no source video concept) | Per-exercise timestamp button → opens YouTube |
| Muscle groups / anatomy | N/A | Pill tags, muscle diagrams, training volume | Pill tags v1, anatomy silhouette v1.x |
| Rest timer / sets-reps display | N/A | Interactive rest timer, set-by-set logging | Static display only — *no live timer in v1* |
| Save without account | Some allow URL share; most push login | Universally require account | URL-encoded share + copy + print |
| Account-gating | Mixed; trend toward "free to summarize, pay to save" | Hard gate at install | None in v1 |
| Edit AI output | Rare; most are read-only | N/A (user enters data) | Inline numeric edit in v1.x |
| Premium aesthetic | Generally utilitarian; light mode | Trending toward dark + glassmorphism (AnyDistance) | Dark + glassmorphism — *the* differentiator |
| Multi-platform input | Some support TikTok/Instagram | N/A | YouTube only v1 |
| AI chatbot on output | Increasingly common | N/A | Explicitly excluded (anti-feature) |
| Generated illustrations | Rare; thumbnails only | Real demo videos / curated GIFs | Link to source timestamp — no generated illustrations |

**Competitive read:** No competitor identified combines (1) YouTube-to-structured-workout extraction with (2) premium fitness-app aesthetic and (3) honest trust signals (timestamps, source quotes). AI summarizers treat workouts like text; fitness apps treat them like user input. The product is the bridge.

## Risk Flags for Roadmap

These are features whose *complexity is hidden* and which will likely need a deeper research/spike pass during their phase:

- **Real-time pipeline status.** SSE vs. polling vs. streaming response is an architecture call; getting it wrong means either a faked status (cliché) or a re-architecture mid-build. Flag for ARCHITECTURE.md.
- **URL-encoded share state.** Payload size + compression + URL length limits + schema versioning. Looks simple, has gotchas. ~2 hour spike before commitment.
- **Glassmorphism mobile performance.** `backdrop-filter` cost on mid-range Android. May need fallback. Flag for UI phase.
- **yt-dlp on Vercel functions.** PROJECT.md already notes binary size / cold start risk. This isn't a *feature* risk per se but it gates the entire pipeline. Flag for ARCHITECTURE.md and the AI-integration phase.

## Sources

- [Glasp YouTube Summary](https://glasp.co/youtube-summary) — no-sign-up URL-paste pattern
- [Heuristica AI YouTube Summarizer](https://www.heuristi.ca/tools/free-ai-youtube-video-summarizer) — same pattern
- [Side Copilot YouTube Summarizer](https://www.sidecopilot.com/tools/youtube-video-summarizer) — minimal-friction UX
- [VideoToWisdom blog on AI timestamps](https://www.videotowisdom.com/blog/youtube-timestamp-ai-summary-tool-every-smart-learner-needs) — clickable timestamps as trust signal
- [MyLens — YouTube to Timeline](https://mylens.ai/youtube-to-timeline) — citation/jump-to-source pattern
- [UX Patterns for Developers — AI Loading States](https://uxpatterns.dev/patterns/ai-intelligence/ai-loading-states) — nondeterministic progress, carousel of info
- [UX Patterns for Developers — AI Error States](https://uxpatterns.dev/patterns/ai-intelligence/ai-error-states) — extraction failure UX
- [Vibe Coder Blog — Empty / Loading / Error States AI Forgets](https://blog.vibecoder.me/empty-states-loading-states-error-states) — the three states AI scaffolds miss
- [Smart Interface Design Patterns — Loading & Progress UX](https://smart-interface-design-patterns.com/articles/designing-better-loading-progress-ux/) — wait-time guidance and microcopy
- [Medium — 6 Loading State Patterns That Feel Premium](https://medium.com/uxdworld/6-loading-state-patterns-that-feel-premium-716aa0fe63e8) — skeleton screens, contextual messaging
- [DEV.to — Share Your Web App State via URL](https://dev.to/maxxmini/share-your-web-app-state-via-url-no-backend-required-1806) — URL-encoded state pattern
- [TanStack Router — URL-as-state best practices](https://github.com/TanStack/router/discussions/1249) — limits and gotchas
- [ACM — Effect of Confidence Indicators on Trust in AI-Generated Profiles](https://dl.acm.org/doi/fullHtml/10.1145/3334480.3382842) — low-confidence indicators hurt trust; high-confidence indicators don't help; *evidence* beats *self-reported confidence*
- [Microsoft Learn — Generative AI UX Guidance](https://learn.microsoft.com/en-us/microsoft-cloud/dev/copilot/isv/ux-guidance) — friction at save/share/copy for AI outputs
- [DesignRush — 10 Best Fitness App Designs](https://www.designrush.com/best-designs/apps/trends/fitness-app-design-examples) — premium fitness aesthetic norms
- [Stormotion — Fitness App UX Principles](https://stormotion.io/blog/fitness-app-ux/) — exercise card patterns, rest timer expectations
- [Hevy — Muscle Group Workout Chart](https://www.hevyapp.com/features/muscle-group-workout-chart/) — anatomy diagram in a real fitness app
- [Bodybuilding Wizard Interactive Muscle Anatomy](https://bodybuilding-wizard.com/interactive-muscle-anatomy/) — silhouette + highlight reference
- [Medium — Dark Glassmorphism: The Aesthetic That Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) — confirms PROJECT.md aesthetic is on-trend
- [Super Dev Resources — 16 Glassmorphism UI Inspirations](https://superdevresources.com/glassmorphism-ui-inspiration/) — AnyDistance and similar fitness examples
- [RevenueCat — Hard vs Soft Paywall](https://www.revenuecat.com/blog/growth/hard-paywall-vs-soft-paywall/) — 40% conversion drop from upfront walls
- [DEV.to — When Upfront Paywalls Hurt Conversion](https://dev.to/paywallpro/when-upfront-paywalls-work-and-when-they-hurt-conversion-54k1) — anti-pattern context
- [MDN — Element: paste event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event) and [web.dev — How to paste text](https://web.dev/patterns/clipboard/paste-text) — clipboard read permissions

---
*Feature research for: AI-powered workout-extraction web app (Exercised, v1 anonymous-only web)*
*Researched: 2026-05-16*
