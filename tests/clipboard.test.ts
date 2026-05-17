/**
 * Clipboard exporter tests (SHRE-01, SHRE-02)
 *
 * Covers:
 * a. Markdown contains # workout_title, ## Superset, 3 × substring
 * b. Plain text contains 1. and a) superset inner marker
 * c. Markdown of empty-form-cues exercise has no orphaned bullet
 * d. Both functions are pure (identical output on repeated calls)
 */
import { describe, it, expect } from "vitest";
import { workoutToMarkdown } from "@/lib/clipboard/markdown";
import { workoutToPlainText } from "@/lib/clipboard/plaintext";
import { WorkoutSchema } from "@/lib/schema/workout";
import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";

const fixture = WorkoutSchema.parse(dumbbellLegDay);

// A workout with an exercise that has no form_cues
const noFormCuesWorkout = WorkoutSchema.parse({
  ...dumbbellLegDay,
  routine: [
    {
      type: "standard_set",
      exercise_name: "Bench Press",
      sets: 3,
      reps: "8",
      rest_seconds: 90,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: null,
      equipment: [],
    },
  ],
});

describe("workoutToMarkdown (SHRE-01)", () => {
  it("a. markdown contains # workout_title, ## Superset, and a sets×reps line", () => {
    const md = workoutToMarkdown(fixture);
    expect(md).toContain(`# ${fixture.workout_title}`);
    expect(md).toContain("## Superset");
    // Sets × reps line — fixture has e.g. "4 × 10-12 @ 60s rest"
    expect(md).toMatch(/\d+ × /);
  });

  it("c. markdown of empty-form-cues exercise has no orphaned bullet", () => {
    const md = workoutToMarkdown(noFormCuesWorkout);
    // Should not have a bare "- " bullet with nothing after it
    expect(md).not.toMatch(/^-\s*$/m);
    // Should still contain the exercise heading
    expect(md).toContain("## Bench Press");
  });

  it("d. markdown is pure — identical output on repeated calls", () => {
    expect(workoutToMarkdown(fixture)).toBe(workoutToMarkdown(fixture));
  });
});

describe("workoutToPlainText (SHRE-02)", () => {
  it("b. plain text contains '1. ' and 'a) ' superset inner marker", () => {
    const text = workoutToPlainText(fixture);
    expect(text).toContain("1. ");
    expect(text).toContain("a) ");
  });

  it("d. plaintext is pure — identical output on repeated calls", () => {
    expect(workoutToPlainText(fixture)).toBe(workoutToPlainText(fixture));
  });
});
