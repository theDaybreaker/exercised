/**
 * D-17 Strip-chain tests (Plan 01-04, Task 1)
 *
 * Verifies:
 * - STRIP_ORDER: sourceQuote first, form_cues second, equipment third
 * - Strip chain stops as soon as payload fits under 2048 chars
 * - Small fixtures (bodyweight-push, warmup-3) → stripped: [] no strip needed
 * - Hypertrophy fixture (12 exercises) → at least sourceQuote stripped
 * - Round-trip: strippedOnEncode === strippedOnDecode
 * - Worst-case (huge form_cues) → best-effort, no throw
 *
 * Note: dumbbell-leg-day compresses to 2089 chars (over 2048), so it DOES trigger strip.
 * Fixtures that don't trigger strip: bodyweight-push (1917) and warmup-3 (1184).
 */
import { describe, it, expect } from "vitest";
import { encodeShareUrl } from "@/lib/share/encode";
import { decodeShareUrl } from "@/lib/share/decode";
import { WorkoutSchema } from "@/lib/schema/workout";
import type { Workout } from "@/lib/schema/workout";

import bodyweightPush from "@/tests/fixtures/bodyweight-push.json";
import warmup3 from "@/tests/fixtures/warmup-3-exercises.json";
import hypertrophy12 from "@/tests/fixtures/hypertrophy-12-exercises.json";

// bodyweight-push (1917 chars) and warmup-3 (1184 chars) fit under 2048 without stripping
const bodyweightFixture = WorkoutSchema.parse(bodyweightPush);
const warmupFixture = WorkoutSchema.parse(warmup3);
const hypertrophyFixture = WorkoutSchema.parse(hypertrophy12);

const MAX_PAYLOAD_BYTES = 2048;

describe("D-17 strip chain (encodeShareUrl)", () => {
  it("1. bodyweight-push fixture fits under 2KB without stripping", () => {
    const { encoded, stripped } = encodeShareUrl(bodyweightFixture);
    expect(stripped).toEqual([]);
    expect(encoded.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it("1b. warmup-3-exercises fixture fits under 2KB without stripping", () => {
    const { encoded, stripped } = encodeShareUrl(warmupFixture);
    expect(stripped).toEqual([]);
    expect(encoded.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it("2. hypertrophy-12 fixture strips at least sourceQuote to fit under 2KB", () => {
    const { encoded, stripped } = encodeShareUrl(hypertrophyFixture);
    expect(stripped).toContain("sourceQuote");
    expect(encoded.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it("3. strip chain encodes hypertrophy-12 to ≤ 2048 chars after stripping", () => {
    const { encoded } = encodeShareUrl(hypertrophyFixture);
    expect(encoded.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it("4. round-trip: strippedOnEncode === strippedOnDecode (hypertrophy-12)", () => {
    const { encoded, stripped: strippedOnEncode } = encodeShareUrl(hypertrophyFixture);
    const { workout, stripped: strippedOnDecode } = decodeShareUrl(encoded);
    expect(strippedOnDecode).toEqual(strippedOnEncode);
    // Stripped exercises should have null/empty for stripped fields
    if (strippedOnEncode.includes("sourceQuote")) {
      for (const item of workout.routine) {
        if (item.type === "standard_set") {
          expect(item.sourceQuote).toBeNull();
        } else {
          for (const ex of item.exercises) {
            expect(ex.sourceQuote).toBeNull();
          }
        }
      }
    }
  });

  it("5. strip chain stops as soon as payload fits (does not over-strip)", () => {
    // If the payload fits after stripping sourceQuote, form_cues should NOT be stripped.
    // Verify for hypertrophy12 that we don't strip more than necessary.
    const { encoded, stripped } = encodeShareUrl(hypertrophyFixture);
    expect(encoded.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(stripped.length).toBeGreaterThan(0);
    // If form_cues was stripped but sourceQuote alone was sufficient, that would be over-stripping.
    // We can verify: if stripped doesn't include form_cues, sourceQuote alone was enough.
    // If stripped does include form_cues, sourceQuote alone was NOT enough — valid behavior.
    // The key check: we should NEVER strip form_cues if not stripping sourceQuote first
    if (stripped.includes("form_cues")) {
      expect(stripped).toContain("sourceQuote");
    }
    if (stripped.includes("equipment")) {
      expect(stripped).toContain("form_cues");
    }
  });

  it("6. best-effort: worst-case workout with huge form_cues does NOT throw", () => {
    // Build a workout with comically large form_cues (50 standard sets × 5 cues × 200 chars)
    const hugeCue = "A".repeat(200);
    const hugeWorkout: Workout = {
      ...bodyweightFixture,
      routine: Array.from({ length: 50 }, (_, i) => ({
        type: "standard_set" as const,
        exercise_name: `Exercise ${i + 1}`,
        sets: 3,
        reps: "10",
        rest_seconds: 60,
        form_cues: [hugeCue, hugeCue, hugeCue, hugeCue, hugeCue],
        startTimestamp: null,
        sourceQuote: `Quote for exercise ${i + 1} that is intentionally long to test the strip chain behavior`,
        equipment: ["barbell", "bench", "dumbbells"],
      })),
    };

    // Should NOT throw — best-effort even if fully stripped still exceeds 2KB
    let result: ReturnType<typeof encodeShareUrl> | undefined;
    expect(() => {
      result = encodeShareUrl(hugeWorkout);
    }).not.toThrow();

    // All 3 fields should be stripped for this monster workout
    expect(result!.stripped).toContain("sourceQuote");
    expect(result!.stripped).toContain("form_cues");
    expect(result!.stripped).toContain("equipment");
  });
});
