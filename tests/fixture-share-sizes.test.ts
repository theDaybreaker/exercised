/**
 * fixture-share-sizes: CI payload-size measurement (Plan 01-04, Task 1)
 *
 * Logs compressed payload size for each of the 5 fixtures.
 * Always passes — the console.log output is the value (visible in CI for monitoring).
 *
 * Open Question Q1 from RESEARCH.md: "will the hypertrophy-12 fixture exceed the 2KB
 * threshold?" — this test answers it directly on every CI run, so future fixture or
 * schema growth is visible before it breaks the URL limit.
 */
import { describe, it, expect } from "vitest";
import { encodeShareUrl } from "@/lib/share/encode";
import { WorkoutSchema } from "@/lib/schema/workout";

import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";
import bodyweightPush from "@/tests/fixtures/bodyweight-push.json";
import fullBody2Supersets from "@/tests/fixtures/full-body-2-supersets.json";
import warmup3 from "@/tests/fixtures/warmup-3-exercises.json";
import hypertrophy12 from "@/tests/fixtures/hypertrophy-12-exercises.json";

describe("fixture-share-sizes: logs compressed sizes for monitoring", () => {
  it("logs encoded size for all 5 fixtures (always passes)", () => {
    const fixtures: Record<string, unknown> = {
      "dumbbell-leg-day": dumbbellLegDay,
      "bodyweight-push": bodyweightPush,
      "full-body-2-supersets": fullBody2Supersets,
      "warmup-3-exercises": warmup3,
      "hypertrophy-12-exercises": hypertrophy12,
    };

    for (const [name, raw] of Object.entries(fixtures)) {
      const workout = WorkoutSchema.parse(raw);
      const { encoded, stripped } = encodeShareUrl(workout);
      console.log(
        `[fixture-size] ${name}: encoded=${encoded.length} bytes, stripped=[${stripped.join(",")}]`
      );
      expect(encoded.length).toBeGreaterThan(0);
    }
  });
});
