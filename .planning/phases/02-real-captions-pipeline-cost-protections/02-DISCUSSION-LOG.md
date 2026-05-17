# Phase 2: Real Captions Pipeline + Cost Protections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 02-real-captions-pipeline-cost-protections
**Areas discussed:** Rate-limit + spend cap, Eval-set + ship gate, Low-confidence banner, DMCA / ToS page, `video_url` schema migration

---

## Pre-discussion: User delegation

When presented with the 4 candidate areas (rate-limit, eval-set, low-confidence banner, DMCA page), the user answered:

> "I don't know a lot about everything that should go in these categories, so if you can just go with best practice and what you recommend for each of these, that would be fun for me."

Per the discuss-phase workflow's `<philosophy>` ("User = founder/visionary, Claude = builder"), this is a valid delegation to the builder. Claude drafted recommended defaults for all 4 areas plus the carry-forward `video_url` migration (D-25) and presented them as a single confirmation. User accepted with "Looks good — lock all 5 decisions." No tweaks requested.

---

## Area 1: Rate-limit + daily spend cap calibration (D-20)

| Option | Description | Selected |
|--------|-------------|----------|
| REQUIREMENTS-as-written: 3-5/min, 20/day, no global cap | Too generous for anonymous; no abuser deterrent | |
| Tech-stack research: 5/hour + global $ cap | Beats REQUIREMENTS; bound by both per-IP and global signals | ✓ |
| Aggressive: 2/hour + $1/day cap | Maximum safety but kills demo UX | |

**User's choice:** Recommended default (5/hour per-IP, 20/day backstop, $5/day global cap).
**Notes:** REQUIREMENTS.md's wording predates the tech-stack research deep-dive; the research-backed numbers supersede. The $5/day cap is intentionally low — easy to tune up after first-week traffic data without a redeploy (Redis-config-driven).

---

## Area 2: Eval-set composition + ship gate (D-21)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum: 3-5 videos, exact-match grading | Fast to author; brittle in practice | |
| Recommended: 9 videos (8 fitness + 1 non-fitness control), binary + rubric criteria | Wide failure-mode coverage; ~30 min to grade once | ✓ |
| Extensive: 25+ videos, fully-automated rubric | Premature; we don't have a rubric scorer yet | |

**User's choice:** Recommended (9 videos, binary criteria gate release, rubric tracked only).
**Notes:** User picks the 9 URLs during Phase 2 planning (they have fitness domain knowledge); Claude provides the slot criteria. The non-fitness control returning `NO_WORKOUT` is the single most important criterion — it's the proof that the system fails honestly. Failing this blocks release.

---

## Area 3: Low-confidence banner trigger + copy (D-23)

| Option | Description | Selected |
|--------|-------------|----------|
| LLM self-report only | Trust the model's `extraction_confidence` field | |
| Multi-signal trigger (LLM + 3 heuristics) | Belt-and-suspenders; surfaces both model + system signals | ✓ |
| No banner; just confidence number in UI | Less invasive but doesn't drive user attention | |

**User's choice:** Recommended multi-signal trigger (LLM `low` OR <3 exercises OR <200 words transcript OR ≥1 dropped `sourceQuote`).
**Notes:** `role="status"` (informational) not `role="alert"` (interrupting) — banner should nudge, not alarm. Amber/yellow accent reserved for "incomplete" semantics; red stays on hard errors.

---

## Area 4: DMCA / ToS / AI-disclaimer page scope (D-24)

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone `/about` page, plain-language | One URL covers all three concerns; easy to upgrade | ✓ |
| Footer modal, plain-language | Less SEO surface; harder to deep-link for takedowns | |
| Three separate pages (/dmca, /terms, /ai-disclaimer) | Premature for v1 traffic | |
| Formal legalese | Premature; flag if takedown notice forces it | |

**User's choice:** Recommended single `/about` page in plain-language with three sections (What this is / AI accuracy / DMCA contact).
**Notes:** Contact email `hello@exercised.app` is a placeholder; flagged in STATE.md as a launch-blocker. User must own the domain or swap to a personal email before the real pipeline deploys.

---

## Area 5: `video_url` schema migration (D-25, Phase 1 carry-forward)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Phase 2 Plan 1 (extraction+schema) | Captions pipeline already has the source URL; one PR | ✓ |
| Standalone Phase 2.1 micro-phase | Cleaner blame but extra ceremony for a 1-field change | |
| Defer to Phase 4 polish | Leaves "Watch on YouTube" as a known stub for two more phases | |

**User's choice:** Fold into Phase 2 (the same plan that touches the schema for real extraction also adds `video_url`).
**Notes:** No `schema_version` bump — adding an optional nullable field is backward-compatible. Existing `?w=` share URLs decode fine. Confirmed by `tests/share-url-roundtrip.test.ts` pattern from Plan 01-02.

---

## Claude's Discretion

Locked here for the planner so they don't need to revisit:

- **Cache key naming:** `extract:v1:${videoId}` (versioned prefix for clean future invalidation)
- **Cache-stampede protection:** Redis lock with 30s timeout (D-26c)
- **Cache hit "⚡ Cached" badge:** Fold from REQUIREMENTS v2 (`POLI-08`) into Phase 2 since it's a 1-line UI affordance + signals the cache works
- **Smoke-test mechanics:** Vercel Cron daily at 09:00 UTC; alert via email + opened GitHub Issue
- **`sourceQuote` validation strictness:** Case-insensitive substring with whitespace normalization; drop offending exercises (don't retry whole extraction); flag workout for low-confidence banner

Researcher / planner retain flexibility on:
- Vercel AI SDK retry semantics (research will surface best practice)
- Exact LLM prompt template wording (drafted against eval-set feedback)
- `BUDGET_EXHAUSTED` as a distinct error variant vs. specialized copy on `RATE_LIMITED` (UI implementation choice)
- shadcn Alert reuse vs. custom `<ConfidenceBanner>` component

## Deferred Ideas

Captured but belong to other phases or v2:

- Audio-fallback path → Phase 3 (already scoped in ROADMAP)
- Per-exercise jump-to-timestamp link → Phase 4 (`POLI-01`)
- `/eval` dashboard route showing rubric trends → Phase 4
- Slack / Discord alert webhook → after v1 traffic data
- Formal legalese for `/about` → only if takedown notice forces it
- Cache-warming for eval-set URLs on deploy → couples deploy to LLM cost; skip
- Per-IP analytics dashboard → Vercel Analytics + Upstash console suffice for v1
