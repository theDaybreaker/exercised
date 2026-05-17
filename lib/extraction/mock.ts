/**
 * MockExtractionService — Phase 1 mock using the dumbbell-leg-day fixture.
 *
 * T-01-04 disposition: Phase 1 is mock-only — every request runs synthetic
 * setTimeout, no AI cost. Rate limiting ships in Phase 2 per ROADMAP.
 *
 * D-14: Fixture is validated via WorkoutSchema.parse() at module load.
 *       Schema drift crashes the function with a named ZodError before any
 *       traffic is served — fails fast at the contract boundary.
 *
 * D-07: Per-stage dwell ~4–5s total (1100/1100/1100/1000ms per stage).
 * D-10: Timer-driven internally but emitted as SSE events — UI is dumb about timing.
 */
import type { ExtractEvent, Workout } from "@/lib/schema/workout";
import { WorkoutSchema } from "@/lib/schema/workout";
import { parseYouTubeUrl } from "@/lib/youtube/url";

import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";

// D-14: parse at module load — schema drift fails fast at init, not runtime
const FIXTURES: Workout[] = [WorkoutSchema.parse(dumbbellLegDay)];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Deterministic hash → fixture index (D-12).
 * Only 1 fixture in Plan 01-01; Plan 01-03 expands FIXTURES array.
 * The hash + mod pattern is already in place so expansion is a one-liner.
 */
function hashStringMod(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export const MockExtractionService = {
  async *extract(url: string): AsyncIterable<ExtractEvent> {
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
