/**
 * MockExtractionService — Phase 1 mock using 5 varied fixtures.
 *
 * T-01-04 disposition: Phase 1 is mock-only — every request runs synthetic
 * setTimeout, no AI cost. Rate limiting ships in Phase 2 per ROADMAP.
 *
 * D-14: All fixtures validated via WorkoutSchema.parse() at module load.
 *       Schema drift crashes the function with a named ZodError before any
 *       traffic is served — fails fast at the contract boundary.
 *
 * D-07: Per-stage dwell ~4–5s total (1100/1100/1100/1000ms per stage).
 * D-10: Timer-driven internally but emitted as SSE events — UI is dumb about timing.
 * D-12: URL → fixture is deterministic via hashStringMod(videoId, FIXTURES.length).
 * D-13: URL-keyword error routing — /fail/i → NETWORK, /empty/i → NO_WORKOUT,
 *       /rate-limit/i → RATE_LIMITED. Keyword check runs BEFORE fixture selection.
 */
import type { ExtractEvent, Workout } from "@/lib/schema/workout";
import { WorkoutSchema } from "@/lib/schema/workout";
import { parseYouTubeUrl } from "@/lib/youtube/url";

import dumbbellLegDayRaw from "@/tests/fixtures/dumbbell-leg-day.json";
import bodyweightPushRaw from "@/tests/fixtures/bodyweight-push.json";
import fullBody2SupersetsRaw from "@/tests/fixtures/full-body-2-supersets.json";
import warmup3Raw from "@/tests/fixtures/warmup-3-exercises.json";
import hypertrophy12Raw from "@/tests/fixtures/hypertrophy-12-exercises.json";

// D-14: parse ALL fixtures at module load — schema drift fails fast at init, not runtime.
// Order: index 0..4 maps to hash-mod-5 buckets (D-12).
const FIXTURES: Workout[] = [
  WorkoutSchema.parse(dumbbellLegDayRaw),      // index 0
  WorkoutSchema.parse(bodyweightPushRaw),       // index 1
  WorkoutSchema.parse(fullBody2SupersetsRaw),   // index 2
  WorkoutSchema.parse(warmup3Raw),              // index 3
  WorkoutSchema.parse(hypertrophy12Raw),        // index 4
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Deterministic hash → fixture index (D-12).
 * hash(videoId) mod FIXTURES.length picks the fixture for any YouTube URL.
 * Same URL always returns the same fixture; different videoIds spread across fixtures.
 */
function hashStringMod(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export const MockExtractionService = {
  async *extract(url: string): AsyncIterable<ExtractEvent> {
    // D-13 — URL-keyword error routing (BEFORE videoId hash selection)
    // These branches let designers and reviewers exercise every error state
    // without code changes by pasting a URL containing the keyword.
    // Priority: fail > empty > rate-limit (checked in order; first match wins).

    if (/fail/i.test(url)) {
      yield { type: "stage", stage: "fetching" };
      await sleep(500);
      yield {
        type: "error",
        code: "NETWORK",
        message: "We couldn't reach the extraction service.",
      };
      return;
    }

    if (/empty/i.test(url)) {
      yield { type: "stage", stage: "fetching" };
      await sleep(700);
      yield { type: "stage", stage: "transcribing" };
      await sleep(700);
      yield {
        type: "error",
        code: "NO_WORKOUT",
        message: "We couldn't find an exercise routine in this video.",
      };
      return;
    }

    if (/rate-limit/i.test(url)) {
      await sleep(300);
      yield {
        type: "error",
        code: "RATE_LIMITED",
        message: "You've extracted a lot of workouts recently.",
      };
      return;
    }

    // D-12 — deterministic fixture selection via videoId hash
    const { videoId } = parseYouTubeUrl(url);
    const seed = videoId ?? url;
    const fixture = FIXTURES[hashStringMod(seed, FIXTURES.length)];

    // D-07 — ~4–5s total, ~1.0–1.2s per stage
    // D-10 — stage transitions emitted as SSE events; UI consumes events, never timers
    yield { type: "stage", stage: "fetching" };
    await sleep(1100);
    yield { type: "stage", stage: "transcribing" };
    await sleep(1100);
    yield { type: "stage", stage: "analyzing" };
    await sleep(1100);
    yield { type: "stage", stage: "generating" };
    await sleep(1000);
    yield { type: "result", workout: fixture };
  },
};
