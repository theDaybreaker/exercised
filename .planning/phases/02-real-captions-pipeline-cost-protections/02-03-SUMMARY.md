---
phase: 02-real-captions-pipeline-cost-protections
plan: 03
subsystem: extraction-pipeline-core
tags: [captions, llm, hallucination-guard, gemini, tdd, ai-sdk, youtube]
dependency_graph:
  requires: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
  provides: [lib/youtube/captions.ts, lib/ai/extract.ts, lib/guards/sourceQuote.ts]
  affects: [app/api/extract/route.ts (wired in 02-04), lib/extraction/real.ts (02-04)]
tech_stack:
  added: []
  patterns:
    - "getCaptions: primary (youtube-caption-extractor getVideoDetails) + fallback (youtube-transcript fetchTranscript)"
    - "generateText + Output.object({ schema: WorkoutSchema }) — AI SDK 6 canonical structured extraction"
    - "google('gemini-2.5-flash') from @ai-sdk/google — Gemini provider (GOOGLE_GENERATIVE_AI_API_KEY)"
    - "normalize + isSubstring: case-insensitive substring with whitespace normalization (D-22)"
    - "Superset promotion: 1 survivor → standard_set; 0 survivors → entire superset dropped"
key_files:
  created:
    - lib/youtube/captions.ts
    - lib/ai/extract.ts
    - lib/guards/sourceQuote.ts
    - tests/captions.test.ts
    - tests/llm-extract.test.ts
    - tests/source-quote.test.ts
  modified: []
decisions:
  - "Provider swap: @ai-sdk/google (gemini-2.5-flash) used instead of @ai-sdk/openai (gpt-4o) per orchestrator direction — GOOGLE_GENERATIVE_AI_API_KEY already in .env.local"
  - "getCaptions uses getVideoDetails() (graceful empty-array on failure) NOT getSubtitles() (throws) per RESEARCH Pitfall 1"
  - "validateSourceQuotes drops individual exercises (not entire workout) on sourceQuote mismatch per D-22"
  - "normalize/isSubstring exported from sourceQuote.ts to enable direct unit testing per plan acceptance criteria"
metrics:
  duration: 4 minutes
  completed_date: "2026-05-18"
  tasks: 3
  files_created: 6
  files_modified: 0
---

# Phase 2 Plan 3: Extraction Pipeline Core Modules Summary

**One-liner:** Three independently-tested extraction pipeline modules — caption fetch with primary+fallback libraries, Gemini 2.5 Flash LLM structuring via AI SDK 6 generateText+Output.object, and a pure sourceQuote hallucination guard with superset promotion logic.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Caption fetch module with primary + fallback | 1345cb9 | lib/youtube/captions.ts, tests/captions.test.ts |
| 2 | LLM extraction + system prompt (Gemini 2.5 Flash) | 7a79a71 | lib/ai/extract.ts, tests/llm-extract.test.ts |
| 3 | sourceQuote hallucination guard | 16d24dd | lib/guards/sourceQuote.ts, tests/source-quote.test.ts |

## What Was Built

### Task 1: getCaptions (lib/youtube/captions.ts)

- **Primary:** `getVideoDetails({ videoID, lang: "en" })` from `youtube-caption-extractor` — returns `{ subtitles: [] }` on failure (no throw), so no try/catch for the empty-array case is needed beyond the length check
- **Fallback:** `YoutubeTranscript.fetchTranscript(videoId)` from `youtube-transcript` — different internal request path provides complementary failure modes against YouTube's bot detection
- **Return:** Joined caption text (`subtitles.map(s => s.text).join(" ")`) or `null` if both fail
- **No retry logic** — per RESEARCH Pitfall 1, retry is route.ts's concern; this module stays simple and testable
- **10 tests** covering: primary success, primary empty array, primary throws, both fail, empty videoId (no throw)

### Task 2: extractWorkout + EXTRACTION_SYSTEM_PROMPT (lib/ai/extract.ts)

- **Provider swap applied:** Uses `google("gemini-2.5-flash")` from `@ai-sdk/google` (not `openai("gpt-4o")`) per orchestrator direction — `GOOGLE_GENERATIVE_AI_API_KEY` env var read automatically
- **AI SDK 6 pattern:** `generateText({ output: Output.object({ schema: WorkoutSchema }) })` — NOT `generateObject` (RESEARCH Pattern 5)
- **`experimental_output`** typed as `Workout` — merged with `videoUrl` argument per D-25b
- **`EXTRACTION_SYSTEM_PROMPT`** covers: sourceQuote verbatim copying, non-fitness low-confidence, timed exercises, sets/reps defaults, creator_username handling
- **`maxRetries: 2`** — retries on network/rate errors; `NoObjectGeneratedError` is immediate (no retry)
- **11 tests** covering: model called, google provider used, videoUrl merged, system prompt passed, transcript in prompt, WorkoutSchema validates result

### Task 3: validateSourceQuotes (lib/guards/sourceQuote.ts)

- **`normalize(s)`** — `s.toLowerCase().replace(/\s+/g, " ").trim()` handles tabs, newlines, multi-space
- **`isSubstring(quote, transcript)`** — empty string returns `false`; otherwise `normalize(transcript).includes(normalize(quote))`
- **`validateSourceQuotes(workout, transcript)`** — pure function, no external dependencies:
  - `sourceQuote === null` → passes (not a hallucination)
  - `sourceQuote` non-null AND not in transcript → exercise dropped, `droppedCount++`
  - Superset: 0 survivors → entire superset dropped; 1 survivor → promoted to `standard_set`; 2+ survivors → superset kept with filtered exercises
- **`droppedCount`** returned for D-23d low-confidence banner trigger in route.ts
- **22 pure-function tests** — no mocking needed; covers all branches including 3-exercise superset with 1 dropped

## Deviations from Plan

### Auto-applied: Provider Swap (Orchestrator Direction)

The plan's `must_haves.truths` specifies `openai("gpt-4o")` but the orchestrator note explicitly instructs using `google("gemini-2.5-flash")` from `@ai-sdk/google`. Applied the swap:

- **lib/ai/extract.ts imports** `google` from `"@ai-sdk/google"` (not `openai` from `"@ai-sdk/openai"`)
- **Model call:** `google("gemini-2.5-flash")` (not `openai("gpt-4o")`)
- **Tests mock** `"@ai-sdk/google"` (not `"@ai-sdk/openai"`)
- `@ai-sdk/google` was installed in Plan 02-02; `GOOGLE_GENERATIVE_AI_API_KEY` is in `.env.local`
- `@ai-sdk/openai` is NOT installed in this project

This deviation is intentional and directed — the plan's `openai("gpt-4o")` references are the stale plan text; the orchestrator's direction is authoritative.

## Verification

```
pnpm test -- tests/captions.test.ts tests/llm-extract.test.ts tests/source-quote.test.ts --run
# Test Files  17 passed (17)
# Tests  172 passed (172)

pnpm typecheck
# Clean — no errors
```

### Acceptance Criteria Check

- [x] `lib/youtube/captions.ts` exists and exports `getCaptions`
- [x] `lib/youtube/captions.ts` imports `getVideoDetails` from `"youtube-caption-extractor"`
- [x] `lib/youtube/captions.ts` imports `YoutubeTranscript` from `"youtube-transcript"`
- [x] `getCaptions` uses `getVideoDetails()` as primary and `fetchTranscript()` as fallback (in that order)
- [x] `getCaptions` returns `null` when both libraries fail (no throw)
- [x] `lib/ai/extract.ts` imports `generateText` from `"ai"` (not `generateObject`)
- [x] `lib/ai/extract.ts` imports `Output` from `"ai"`
- [x] `lib/ai/extract.ts` contains `Output.object({ schema: WorkoutSchema })`
- [x] `lib/ai/extract.ts` uses `google("gemini-2.5-flash")` (provider swap applied)
- [x] `lib/ai/extract.ts` exports `EXTRACTION_SYSTEM_PROMPT` (non-empty string with sourceQuote + extraction_confidence guidance)
- [x] `lib/ai/extract.ts` exports `extractWorkout`
- [x] `extractWorkout` merges `videoUrl` into returned workout (`workout.video_url === videoUrl`)
- [x] `lib/guards/sourceQuote.ts` exports `validateSourceQuotes`
- [x] `lib/guards/sourceQuote.ts` exports `normalize` (directly testable)
- [x] `validateSourceQuotes` drops exercises with non-null `sourceQuote` that fails case-insensitive substring match
- [x] `validateSourceQuotes` keeps exercises with `null` sourceQuote
- [x] `validateSourceQuotes` promotes a superset with 1 survivor to `standard_set`
- [x] `validateSourceQuotes` drops an entire superset with 0 survivors
- [x] `validateSourceQuotes` returns `droppedCount` accurately
- [x] All 3 test files exit 0
- [x] `pnpm typecheck` exits 0

## Stub Tracking

No stubs. All three modules are fully implemented pure library functions with complete logic. No hardcoded empty values flow to UI rendering. No TODOs or FIXMEs left in implementation files.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. `lib/ai/extract.ts` accesses `GOOGLE_GENERATIVE_AI_API_KEY` only via the `@ai-sdk/google` provider (never logged or serialized — T-02-03-01 mitigated). `Output.object({ schema: WorkoutSchema })` enforces schema conformance on LLM output (T-02-03-02 mitigated). `validateSourceQuotes` guards against fabricated sourceQuotes (T-02-03-03 mitigated).

## Self-Check: PASSED
