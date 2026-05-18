/**
 * Unit tests for lib/guards/sourceQuote.ts
 *
 * Pure functions — no external dependencies, no mocking needed.
 * Tests verify:
 *  - normalize() behavior (lowercase, whitespace collapse, trim)
 *  - isSubstring() case-insensitive matching
 *  - validateSourceQuotes() exercise filtering rules
 *  - validateSourceQuotes() superset promotion/drop edge cases
 *  - validateSourceQuotes() droppedCount accuracy
 */
import { describe, it, expect } from "vitest";

// ─── Shared transcript for tests ───────────────────────────────────────────
const TRANSCRIPT =
  "Let's do squats today and then some bench press. We'll also do deadlifts for the posterior chain.";

// ─── Helper: build a standard_set routine item ─────────────────────────────
function makeStandardSet(
  name: string,
  sourceQuote: string | null = null,
) {
  return {
    type: "standard_set" as const,
    exercise_name: name,
    sets: 3,
    reps: "10",
    rest_seconds: 60,
    form_cues: [],
    startTimestamp: null,
    sourceQuote,
    equipment: [],
  };
}

// ─── Helper: build a superset routine item ─────────────────────────────────
function makeSuperset(
  exercises: Array<{ name: string; sourceQuote: string | null }>,
) {
  return {
    type: "superset" as const,
    rest_seconds: 90,
    exercises: exercises.map(({ name, sourceQuote }) => ({
      exercise_name: name,
      sets: 3,
      reps: "10",
      rest_seconds: 0,
      form_cues: [],
      startTimestamp: null,
      sourceQuote,
      equipment: [],
    })),
  };
}

// ─── Helper: build a minimal valid Workout ──────────────────────────────────
function makeWorkout(routine: unknown[]) {
  return {
    schema_version: "1" as const,
    workout_title: "Test Workout",
    creator_username: "testcreator",
    target_muscles: [],
    estimated_duration_mins: 30,
    difficulty: "intermediate" as const,
    extraction_confidence: "high" as const,
    video_url: null,
    routine,
  } as Parameters<typeof import("@/lib/guards/sourceQuote").validateSourceQuotes>[0];
}

describe("lib/guards/sourceQuote", () => {
  describe("normalize()", () => {
    it('normalizes "  Hello   World  " to "hello world"', async () => {
      const { normalize } = await import("@/lib/guards/sourceQuote");
      expect(normalize("  Hello   World  ")).toBe("hello world");
    });

    it("lowercases all characters", async () => {
      const { normalize } = await import("@/lib/guards/sourceQuote");
      expect(normalize("BENCH PRESS")).toBe("bench press");
    });

    it("collapses multiple spaces to a single space", async () => {
      const { normalize } = await import("@/lib/guards/sourceQuote");
      expect(normalize("a  b   c    d")).toBe("a b c d");
    });

    it("trims leading and trailing whitespace", async () => {
      const { normalize } = await import("@/lib/guards/sourceQuote");
      expect(normalize("  squat  ")).toBe("squat");
    });

    it("handles newlines and tabs in whitespace collapse", async () => {
      const { normalize } = await import("@/lib/guards/sourceQuote");
      expect(normalize("do\tsquats\nnow")).toBe("do squats now");
    });
  });

  describe("isSubstring()", () => {
    it("returns true when quote is a substring of transcript (case-sensitive match)", async () => {
      const { isSubstring } = await import("@/lib/guards/sourceQuote");
      expect(isSubstring("do squats today", TRANSCRIPT)).toBe(true);
    });

    it("returns true when match requires case-insensitive comparison", async () => {
      const { isSubstring } = await import("@/lib/guards/sourceQuote");
      expect(isSubstring("Do Squats Today", TRANSCRIPT)).toBe(true);
    });

    it("returns true with extra whitespace in quote", async () => {
      const { isSubstring } = await import("@/lib/guards/sourceQuote");
      expect(isSubstring("bench  press", TRANSCRIPT)).toBe(true);
    });

    it("returns false when quote does not appear in transcript", async () => {
      const { isSubstring } = await import("@/lib/guards/sourceQuote");
      expect(isSubstring("pull-ups for 5 sets", TRANSCRIPT)).toBe(false);
    });

    it("returns false for empty string quote", async () => {
      const { isSubstring } = await import("@/lib/guards/sourceQuote");
      expect(isSubstring("", TRANSCRIPT)).toBe(false);
    });
  });

  describe("validateSourceQuotes() — standard_set exercises", () => {
    it("keeps exercise with null sourceQuote (null is not a hallucination)", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([makeStandardSet("Squats", null)]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(droppedCount).toBe(0);
    });

    it("keeps exercise with sourceQuote that IS in transcript", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([makeStandardSet("Squats", "do squats today")]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(droppedCount).toBe(0);
    });

    it("drops exercise with sourceQuote that is NOT in transcript", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([makeStandardSet("Curls", "do some curls now")]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(0);
      expect(droppedCount).toBe(1);
    });

    it("drops exercise with non-matching quote but keeps matching one (mixed routine)", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeStandardSet("Squats", "do squats today"),
        makeStandardSet("Curls", "do some curls now"),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect((result.routine[0] as { exercise_name: string }).exercise_name).toBe("Squats");
      expect(droppedCount).toBe(1);
    });

    it("droppedCount is 0 when no exercises are dropped", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeStandardSet("Squats", "do squats today"),
        makeStandardSet("Bench Press", "some bench press"),
      ]);
      const { droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(droppedCount).toBe(0);
    });

    it("returns same routine length when droppedCount is 0", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeStandardSet("Squats", null),
        makeStandardSet("Deadlifts", "deadlifts for the posterior"),
      ]);
      const { workout: result } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(2);
    });
  });

  describe("validateSourceQuotes() — superset edge cases", () => {
    it("keeps superset when both exercises pass validation", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeSuperset([
          { name: "Squats", sourceQuote: "do squats today" },
          { name: "Bench Press", sourceQuote: "some bench press" },
        ]),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(result.routine[0].type).toBe("superset");
      expect(droppedCount).toBe(0);
    });

    it("drops entire superset when both exercises fail validation", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeSuperset([
          { name: "Curls", sourceQuote: "do some curls" },
          { name: "Tricep Extensions", sourceQuote: "tricep extensions now" },
        ]),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(0);
      expect(droppedCount).toBe(2);
    });

    it("promotes superset with 1 survivor to standard_set", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeSuperset([
          { name: "Squats", sourceQuote: "do squats today" },
          { name: "Curls", sourceQuote: "do some curls" },
        ]),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(result.routine[0].type).toBe("standard_set");
      expect((result.routine[0] as { exercise_name: string }).exercise_name).toBe("Squats");
      expect(droppedCount).toBe(1);
    });

    it("keeps superset with 3 exercises when 1 is dropped (2 remaining)", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeSuperset([
          { name: "Squats", sourceQuote: "do squats today" },
          { name: "Curls", sourceQuote: "do some curls" },
          { name: "Deadlifts", sourceQuote: "deadlifts for the posterior" },
        ]),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(result.routine[0].type).toBe("superset");
      const superset = result.routine[0] as { type: "superset"; exercises: unknown[] };
      expect(superset.exercises).toHaveLength(2);
      expect(droppedCount).toBe(1);
    });

    it("handles superset where inner exercises have null sourceQuote (all pass)", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeSuperset([
          { name: "Squats", sourceQuote: null },
          { name: "Bench Press", sourceQuote: null },
        ]),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      expect(result.routine).toHaveLength(1);
      expect(result.routine[0].type).toBe("superset");
      expect(droppedCount).toBe(0);
    });
  });

  describe("validateSourceQuotes() — mixed routine", () => {
    it("handles routine with standard_set + superset mixed correctly", async () => {
      const { validateSourceQuotes } = await import("@/lib/guards/sourceQuote");
      const workout = makeWorkout([
        makeStandardSet("Squats", "do squats today"),
        makeSuperset([
          { name: "Bench Press", sourceQuote: "some bench press" },
          { name: "Curls", sourceQuote: "do some curls" },
        ]),
        makeStandardSet("Deadlifts", "deadlifts for the posterior"),
      ]);
      const { workout: result, droppedCount } = validateSourceQuotes(workout, TRANSCRIPT);
      // Standard sets: Squats (kept), Deadlifts (kept)
      // Superset: Bench Press (kept), Curls (dropped) → promoted to standard_set
      expect(result.routine).toHaveLength(3); // Squats + promoted Bench Press + Deadlifts
      expect(droppedCount).toBe(1);
    });
  });
});
