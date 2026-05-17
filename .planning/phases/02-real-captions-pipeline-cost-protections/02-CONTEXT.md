# Phase 2: Real Captions Pipeline + Cost Protections - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `MockExtractionService` with a real captions-first extraction pipeline (`youtube-caption-extractor` → GPT-4o `generateObject(WorkoutSchema)` via Vercel AI SDK), shipped in the **same release** as the full 8-defense cost-protection stack. The first OpenAI key is deployed only when **all of**: per-IP rate limit, videoId cache, global daily spend cap, OpenAI + Vercel budget caps, runtime `sourceQuote` hallucination guard, low-confidence banner, DMCA/AI-disclaimer page, and daily smoke test are live in production.

The eval set (8 fitness videos + 1 non-fitness control) is the ship gate — the release is blocked until it passes binary criteria. Phase 3 (audio fallback for uncaptioned videos) is out of scope here; Phase 2 ships the captions path only.

Phase 2 also closes a Phase 1 carry-forward: `video_url` is added to `WorkoutSchema` so "Watch on YouTube" can link to the source video (not just the `@creator` channel).

</domain>

<decisions>
## Implementation Decisions

### Rate-Limit + Daily Spend Cap (D-20)

- **D-20a:** Per-IP sliding window = **5 extractions / 1 hour** (via `@upstash/ratelimit` sliding-window algorithm). Beats REQUIREMENTS' "3-5/min, 20/day" — that pairing is too generous for anonymous traffic and too coarse for abuser containment. The hour-window is research-backed (tech-stack research, PROJECT.md "Rate limiting" section).
- **D-20b:** Per-IP daily cap = **20 / 24h** as a backstop against abusers who pace exactly to dodge the hourly window.
- **D-20c:** Global daily spend cap = **$5/day** initial; ~250 extractions/day across all IPs at ~$0.02/extraction (captions+LLM). Tunable upward after the first week of real traffic without a redeploy (Redis config key).
- **D-20d:** Rate-limit HTTP response: `429` + `Retry-After` header + `X-RateLimit-Remaining` header + JSON body `{ error: "RATE_LIMITED", message }`. ExtractFlow renders the existing `RATE_LIMITED` `ErrorState` (shipped Phase 01-03) with copy: *"You've extracted 5 workouts in the last hour. Try again in a bit."*
- **D-20e:** Spend-cap response: new `BUDGET_EXHAUSTED` error code in the SSE event schema (additive — does not break Phase 1 clients). UI copy: *"We're popular today — try again tomorrow. (Daily extraction budget refills at midnight UTC.)"*
- **D-20f:** **Share-link reads stay free** — opening a `?w=` URL never hits `/api/extract` (already true from Plan 01-02). Reaffirmed here so power users sharing routines don't burn rate-limit quota.

### Eval-Set Composition + Ship Gate (D-21)

- **D-21a:** Set size = **9 videos** (8 fitness + 1 non-fitness control). Small enough to grade in ~30 min by a human; broad enough to surface common failure modes.
- **D-21b:** Composition (URLs picked by user during planning; criteria locked here):
  1. Dumbbell strength (intermediate) — baseline
  2. Barbell strength (advanced) — plate math, RPE language
  3. Bodyweight HIIT — timed reps, AMRAP
  4. Calisthenics — compound + bodyweight terminology
  5. Yoga / mobility flow — time-based "reps", schema stress
  6. Superset-heavy session — superset-path coverage
  7. Long-format (45+ min, 10+ exercises) — size + 2KB strip-chain real-world test
  8. Minimalist (3-4 exercises, <15 min) — short transcripts
  9. **Non-fitness control** (cooking / vlog / gaming) — must return `NO_WORKOUT` (fabrication block)
- **D-21c:** **Binary pass criteria (release-blocking):**
  - Schema validates: **100%** of fitness videos return valid `WorkoutSchema`
  - Hallucination guard: **100%** of returned exercises have a `sourceQuote` that substring-matches the transcript (also enforced at runtime per EXTR-03)
  - Recall: **≥80%** of exercises mentioned in captions appear in the extraction (per fitness video)
  - Non-fitness control: returns `NO_WORKOUT`, not a fabricated workout
- **D-21d:** **Rubric criteria (tracked, not blocking initially):**
  - Sets / reps / rest accuracy — 1-5 score per video
  - Difficulty + `target_muscles` plausibility — 1-5 score per video
- **D-21e:** Lives at `tests/eval/{slug}.json` (one expected-output file per video) + `tests/eval/run.ts` (executable as `pnpm eval`). Eval runner reports per-criterion pass/fail; binary failures exit non-zero. CI runs on every PR touching `lib/extraction/real.ts`.

### Hallucination Guard Strictness (claimed by EXTR-03; resolved here)

- **D-22:** `sourceQuote` validation is a **case-insensitive substring match with whitespace normalization** (collapse multiple spaces, trim) against the full transcript. On mismatch: **drop the offending exercise** from the returned routine (do not retry the whole extraction — that doubles latency + cost). If ≥1 exercise was dropped, the workout is flagged for the low-confidence banner (D-23).

### Low-Confidence Banner Trigger + Copy (D-23)

Banner fires when **ANY** of these are true:
- **D-23a:** LLM returns `extraction_confidence: "low"` in the structured output (model self-assessment)
- **D-23b:** Routine has **fewer than 3 exercises** (heuristic — likely misclassified)
- **D-23c:** Caption transcript was **fewer than 200 words** (heuristic — insufficient signal)
- **D-23d:** **≥1 exercise had its `sourceQuote` dropped** by the EXTR-03 validation (carries forward from D-22)

- **D-23e:** Copy: *"Heads up — this extraction may be incomplete. Skim the source video for anything we missed."*
- **D-23f:** Visual: amber/yellow accent (NOT red — red is reserved for ErrorState); `role="status"` (informational, non-interrupting); renders above `<WorkoutHeader>`; dismissible (state local to the view, not persisted).

### DMCA / ToS / AI-Disclaimer Page (D-24)

- **D-24a:** **Single standalone page at `/about`** (App Router static route). Not a modal. Linked from the existing footer next to the AI-disclaimer one-liner via a small "Terms & DMCA" link.
- **D-24b:** Plain-language tone (NOT formal legalese for v1; upgradable later if traffic warrants).
- **D-24c:** Three sections on one page:
  1. **What this is** — "Exercised extracts workout routines from public YouTube videos using AI. We don't host, store, or redistribute the source videos."
  2. **AI accuracy** — "Extractions are AI-generated and may be incomplete or wrong. Always verify form and reps against the source video."
  3. **DMCA / takedowns** — "If you're a creator and want a video's extraction blocked or removed, email us at `hello@exercised.app` with the YouTube URL. We respond within 7 business days."
- **D-24d:** Contact email = **`hello@exercised.app`** (placeholder). Phase 2 ship-blocker: user must either own the domain + set up a forwarder, or swap to a personal email before the release ships. Flagged in DISCUSSION-LOG.md and in STATE.md "Blockers/Concerns" for follow-up.

### Schema Migration (D-25 — Phase 1 OUTV-05 carry-forward)

- **D-25a:** Add `video_url: z.string().url().nullable()` to `WorkoutSchema`. Nullable so existing fixtures and future synthetic test data can omit it.
- **D-25b:** Real captions path populates `video_url` from the user-pasted URL (already in `ExtractRequestSchema.url`).
- **D-25c:** Backfill all 5 Phase 1 fixtures with their notional source URLs (or `null` for synthetic ones — designer's choice during planning).
- **D-25d:** Update `<ActionBar>` "Watch on YouTube" link logic: prefer `video_url` when present; fall back to `https://youtube.com/@${creator_username}` otherwise.
- **D-25e:** **No `schema_version` bump.** Adding an optional nullable field is backward-compatible — existing `?w=` share URLs decode fine because Zod fills in `null` for missing optional fields. Confirmed by re-running `tests/share-url-roundtrip.test.ts` (already exists) after the schema change.

### Cost Protection — Cache Semantics (Claude's discretion, locked here for planner)

- **D-26a:** Cache key = `extract:v1:${videoId}` (versioned prefix lets us invalidate a generation cleanly without flushing Redis if we change the prompt template). TTL = 30 days per REQUIREMENTS COST-01.
- **D-26b:** Cache stores the **full result event payload** (the validated `WorkoutSchema` JSON) — not the raw caption text. Avoids re-validating on every cache hit.
- **D-26c:** Cache-stampede protection: when a cold-cache extraction is in-flight, subsequent identical `videoId` requests **block on a Redis lock** with a 30-second timeout, then read from the freshly-populated cache. Prevents N concurrent OpenAI calls for the same video at launch.
- **D-26d:** Cache reads do NOT consume rate-limit quota (an extraction served from cache is effectively free). Render a small "⚡ Cached" badge per `POLI-08` (REQUIREMENTS v2) — actually fold into Phase 2 since it's a 1-line UI affordance and signals the cache works.

### Smoke Test Mechanics (Claude's discretion, locked here for planner)

- **D-27a:** Daily smoke test runs via **Vercel Cron** (`vercel.json` `crons` entry; native to the platform, no extra infra). Time: 09:00 UTC daily.
- **D-27b:** Hits `/api/extract` against a **known-good fixture-captioned video** (URL stored in `tests/eval/smoke.json` — same shape as the eval set). Asserts the extraction matches the expected `videoId`, returns valid `WorkoutSchema`, and contains expected number of exercises ±1.
- **D-27c:** Alert channel: **email to the project owner** via Resend (or a simple `mailto` SMTP forward) — keeps the dependency surface tiny for v1. Slack/Discord webhook can be added later.
- **D-27d:** Failure surfaces as an opened GitHub Issue (via `gh` CLI in the cron handler) so the alert is durable and discoverable, not just a transient email.

### Claude's Discretion

- Whether to use Vercel AI SDK's `generateObject` with explicit retry semantics or wrap manually (researcher will recommend during Phase 2 research).
- Prompt template wording for the LLM extraction (researcher + planner will draft against eval-set feedback).
- Exact Redis key naming convention beyond the `extract:v1:` prefix locked in D-26a.
- Whether `BUDGET_EXHAUSTED` is a per-IP-distinct error type or rolled into the existing `RATE_LIMITED` error code with different copy (UI implementation detail).
- Whether the low-confidence banner uses an existing `shadcn` Alert variant or a custom `<ConfidenceBanner>` component (planner decides based on theme consistency).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, Key Decisions table (especially "Mock `/api/extract` ships before real pipeline", "JSON schema is the mock/real contract", and the newly-added Phase 1 acceptance entries)
- `.planning/REQUIREMENTS.md` — Phase 2 REQ-IDs: EXTR-01, EXTR-02, EXTR-03, EXTR-04, COST-01, COST-02, COST-03, COST-04, ERRS-04, OPS-04, OPS-05
- `.planning/ROADMAP.md` — Phase 2 Goal + 5 Success Criteria
- `.planning/STATE.md` — Current status (Phase 1 complete, production live)

### Phase 1 outputs (the foundation Phase 2 extends)
- `.planning/phases/01-mock-deployable-premium-ui-demo/01-CONTEXT.md` — Locked decisions Phase 2 inherits (EXTRACT_MODE swap, schema-version, share-link semantics)
- `.planning/phases/01-mock-deployable-premium-ui-demo/01-VERIFICATION.md` — Documented deviations and carry-forwards (OUTV-05 stub → D-25)
- `.planning/phases/01-mock-deployable-premium-ui-demo/01-04-SUMMARY.md` — D-17 strip-chain payload sizes (dumbbell-leg-day at 2089 bytes is the canonical "above-threshold" case)

### Tech stack and research (from PROJECT.md)
- Vercel AI SDK `generateObject` + Zod — primary extraction primitive
- `@upstash/ratelimit` sliding-window — already pinned in package versioning section
- `@upstash/redis` — videoId cache backend
- `youtube-caption-extractor` (primary) + `youtube-transcript` (fallback) — caption fetch
- OpenAI Structured Outputs against GPT-4o — grammar-level schema conformance

### Live system reference
- `lib/extraction/service.ts` — Factory with `EXTRACT_MODE` switch (Phase 2 replaces the `real.ts` stub)
- `lib/extraction/real.ts` — Throws on call; Phase 2 replaces this entire file
- `lib/extraction/mock.ts` — Reference implementation for SSE event shape, error-routing keyword behavior, fixture-validation pattern at module load
- `lib/schema/workout.ts` — Locked schema; D-25 adds `video_url` here
- `lib/schema/workout.ts` (`SharePayloadSchema`) — Wrapper format; D-25 schema change must preserve round-trip
- `app/api/extract/route.ts` — SSE route handler with 4 critical headers, `maxDuration=300`
- `components/extract/ExtractFlow.tsx` — Consumes SSE events; D-20/D-23 add new event types here

### No external ADRs / formal specs yet
No additional ADR or spec docs beyond the .planning/ tree. All decisions live in CONTEXT.md / VERIFICATION.md / SUMMARY.md per phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`MockExtractionService`** (`lib/extraction/mock.ts`) — Reference implementation: returns `AsyncIterable<ExtractEvent>`, validates fixtures at module load, emits 4 stage events + 1 result event with deliberate dwells. Mirror its event shape exactly in `RealExtractionService` so frontend consumers (`ExtractFlow`) need no changes for the `EXTRACT_MODE=real` swap.
- **`ExtractEventSchema`** (`lib/schema/workout.ts`) — Already a discriminated union over `stage | result | error`. Phase 2 adds `BUDGET_EXHAUSTED` to the `error.code` enum (additive — Phase 1 client handles unknown codes via its existing `UNKNOWN` fallback path).
- **`ErrorState`** (`components/extract/ErrorState.tsx`) — 4 variants already exist from Plan 01-03 (`NETWORK`, `NO_WORKOUT`, `RATE_LIMITED`, `UNKNOWN`). Add a 5th `BUDGET_EXHAUSTED` variant for D-20e copy. `RATE_LIMITED` is already wired for D-20d.
- **`tests/fixtures/*.json`** — 5 fixtures used by mock; serve as ground-truth examples when authoring the eval-set expected outputs.
- **`tests/fixture-share-sizes.test.ts`** — CI assertion that each fixture's compressed share-URL payload stays measurable; reuse pattern to assert real extractions also fit.

### Established Patterns

- **TDD RED → GREEN per task** — Plan 01-02 / 01-03 / 01-04 all committed a failing test before the implementation. Researcher should plan eval-set tests + ratelimit tests + cache tests with this rhythm.
- **Module-load fixture validation** — `MockExtractionService` does `WorkoutSchema.parse(fixture)` at import time; the real-pipeline LLM output gets the same treatment via `generateObject(WorkoutSchema)`.
- **Streamed SSE with 4 critical headers** — `app/api/extract/route.ts` already sets `Content-Type: text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no`, `Connection: keep-alive`. Phase 2 inherits all four; do not remove or weaken any header (Pitfall 1 mitigation).
- **`SharePayloadSchema` wrapper preserves round-trip** — Adding `video_url` to `WorkoutSchema` (D-25) must keep `tests/share-url-roundtrip.test.ts` green. The wrapper means D-17 strip-chain doesn't need updating; the new field just becomes another candidate for stripping if oversized.
- **`AsyncIterable<ExtractEvent>`** — Service interface; both mock + real conform. Don't refactor to Promises or callbacks.

### Integration Points

- **Upstash Redis** — New external dependency. Phase 2 plan must include `.env.example` updates (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OPENAI_API_KEY`) AND Vercel env-var configuration before merge (else Vercel deploy crashes).
- **OpenAI dashboard** — D-20c spend cap exists in three places: (1) global Vercel budget cap, (2) OpenAI org-level budget cap, (3) our application-level Redis counter. All three ship together (COST-04). Owner-action required pre-merge.
- **Vercel Cron** — D-27a smoke test requires `vercel.json` `crons` entry; first run is 24h after deploy.
- **Email infrastructure** — D-27c smoke-test alerts + D-24d DMCA contact both depend on the user having *some* reachable email. Block-list item before launch.
- **`/about` static route** — D-24 adds `app/about/page.tsx`; no API surface; ships with the same deploy as the real pipeline.

</code_context>

<specifics>
## Specific Ideas

- **Dumbbell-leg-day fixture is 2089 bytes** — above the 2KB strip threshold. Real extractions on long-format fitness videos will routinely require the D-17 strip chain. The strip chain is already battle-tested in CI; Phase 2 should add at least one real-world-scale eval-set extraction to `fixture-share-sizes.test.ts` so we catch payload regressions.
- **The non-fitness control video must return `NO_WORKOUT`, not a fabricated workout.** This is the single most important eval criterion — it's the one that proves the system fails honestly rather than hallucinating. Failing this blocks the release per D-21c.
- **All 8 cost defenses ship in the same PR as the first OpenAI key.** This is a project-level non-negotiable from PROJECT.md Key Decisions. No "ship the pipeline first, defenses next week." Planner must structure the plan to make a partial merge impossible.
- **The `EXTRACT_MODE` swap is intentional** — flipping to `real` in production should be the deliberate final commit of Phase 2, not an env-var toggle pushed from a dashboard. Cut a tagged release at that boundary.
- **Email at `hello@exercised.app` is a placeholder** — flagged in STATE.md "Blockers/Concerns" for the planner. Phase 2 cannot ship until the email is reachable.

</specifics>

<deferred>
## Deferred Ideas

Captured during discussion but belong to other phases or v2+.

- **Audio-fallback path (Whisper / `gpt-4o-mini-transcribe`)** — explicit Phase 3 scope per ROADMAP. Captions-only in Phase 2 is intentional (10× cheaper, 10× faster, sidesteps yt-dlp/Vercel pitfall for the common path).
- **Per-exercise jump-to-timestamp link** — `startTimestamp` is in the schema; rendered UI deferred to Phase 4 (`POLI-01`). The real captions pipeline gives us real timestamps; we keep them in the data but don't surface them yet.
- **`/eval` dashboard route showing rubric trends over time** — useful once the eval set runs in CI for weeks. Defer to Phase 4 or sooner if extraction-quality regressions become a problem.
- **Slack / Discord alert channel for smoke test** — email + GitHub Issue is sufficient for v1 traffic (D-27c). Add a webhook later if alert volume warrants.
- **Formal legalese for `/about`** — Phase 2 ships plain-language (D-24b). Upgrade only if traffic or a takedown notice forces a more rigorous treatment.
- **Cache-warming for the eval-set URLs on deploy** — would make smoke tests cheaper but couples deploy to LLM cost. Skip; cold-cache eval runs are intentional (they validate the cold path).
- **Per-IP analytics dashboard** — Upstash supports counting reads, but a real dashboard is its own UI surface. Defer to Phase 4 or treat as "look at Vercel Analytics + Upstash console" for now.

</deferred>

---

*Phase: 2-Real Captions Pipeline + Cost Protections*
*Context gathered: 2026-05-17*
