import { describe, it, expect } from "vitest";
import { WorkoutSchema } from "@/lib/schema/workout";
import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";
import bodyweightPush from "@/tests/fixtures/bodyweight-push.json";
import fullBody2Supersets from "@/tests/fixtures/full-body-2-supersets.json";
import warmup3 from "@/tests/fixtures/warmup-3-exercises.json";
import hypertrophy12 from "@/tests/fixtures/hypertrophy-12-exercises.json";

describe("WorkoutSchema", () => {
  // ── Fixture 1: dumbbell-leg-day (baseline) ──────────────────────────────
  it("should parse dumbbell-leg-day fixture without throwing", () => {
    expect(() => WorkoutSchema.parse(dumbbellLegDay)).not.toThrow();
  });

  it("should have schema_version === '1'", () => {
    const parsed = WorkoutSchema.parse(dumbbellLegDay);
    expect(parsed.schema_version).toBe("1");
  });

  it("should have at least 1 routine entry", () => {
    const parsed = WorkoutSchema.parse(dumbbellLegDay);
    expect(parsed.routine.length).toBeGreaterThanOrEqual(1);
  });

  it("should have at least one superset entry in the routine", () => {
    const parsed = WorkoutSchema.parse(dumbbellLegDay);
    const supersets = parsed.routine.filter((item) => item.type === "superset");
    expect(supersets.length).toBeGreaterThanOrEqual(1);
  });

  it("should have the expected top-level fields", () => {
    const parsed = WorkoutSchema.parse(dumbbellLegDay);
    expect(parsed.workout_title).toBeTruthy();
    expect(parsed.creator_username).toBeTruthy();
    expect(parsed.estimated_duration_mins).toBeGreaterThan(0);
    expect(["beginner", "intermediate", "advanced"]).toContain(
      parsed.difficulty
    );
    expect(["high", "medium", "low"]).toContain(parsed.extraction_confidence);
  });

  // ── Fixture 2: bodyweight-push (no supersets, beginner) ─────────────────
  it("should parse bodyweight-push fixture without throwing", () => {
    expect(() => WorkoutSchema.parse(bodyweightPush)).not.toThrow();
  });

  it("bodyweight-push: difficulty should be 'beginner'", () => {
    const parsed = WorkoutSchema.parse(bodyweightPush);
    expect(parsed.difficulty).toBe("beginner");
  });

  it("bodyweight-push: should have at least 3 routine entries", () => {
    const parsed = WorkoutSchema.parse(bodyweightPush);
    expect(parsed.routine.length).toBeGreaterThanOrEqual(3);
  });

  it("bodyweight-push: should have ZERO superset entries (flat list)", () => {
    const parsed = WorkoutSchema.parse(bodyweightPush);
    const supersets = parsed.routine.filter((item) => item.type === "superset");
    expect(supersets.length).toBe(0);
  });

  // ── Fixture 3: full-body-2-supersets (multiple supersets, advanced) ──────
  it("should parse full-body-2-supersets fixture without throwing", () => {
    expect(() => WorkoutSchema.parse(fullBody2Supersets)).not.toThrow();
  });

  it("full-body-2-supersets: difficulty should be 'advanced'", () => {
    const parsed = WorkoutSchema.parse(fullBody2Supersets);
    expect(parsed.difficulty).toBe("advanced");
  });

  it("full-body-2-supersets: should have AT LEAST 2 superset entries", () => {
    const parsed = WorkoutSchema.parse(fullBody2Supersets);
    const supersets = parsed.routine.filter((item) => item.type === "superset");
    expect(supersets.length).toBeGreaterThanOrEqual(2);
  });

  // ── Fixture 4: warmup-3-exercises (short content) ────────────────────────
  it("should parse warmup-3-exercises fixture without throwing", () => {
    expect(() => WorkoutSchema.parse(warmup3)).not.toThrow();
  });

  it("warmup-3-exercises: should have exactly 3 or 4 routine entries", () => {
    const parsed = WorkoutSchema.parse(warmup3);
    expect(parsed.routine.length).toBeGreaterThanOrEqual(3);
    expect(parsed.routine.length).toBeLessThanOrEqual(4);
  });

  // ── Fixture 5: hypertrophy-12-exercises (long scrolling list) ───────────
  it("should parse hypertrophy-12-exercises fixture without throwing", () => {
    expect(() => WorkoutSchema.parse(hypertrophy12)).not.toThrow();
  });

  it("hypertrophy-12-exercises: difficulty should be 'intermediate'", () => {
    const parsed = WorkoutSchema.parse(hypertrophy12);
    expect(parsed.difficulty).toBe("intermediate");
  });

  it("hypertrophy-12-exercises: should have AT LEAST 12 routine entries", () => {
    const parsed = WorkoutSchema.parse(hypertrophy12);
    expect(parsed.routine.length).toBeGreaterThanOrEqual(12);
  });

  // ── All 5 fixtures have schema_version: "1" ──────────────────────────────
  it("all 5 fixtures should have schema_version === '1'", () => {
    const all = [
      dumbbellLegDay,
      bodyweightPush,
      fullBody2Supersets,
      warmup3,
      hypertrophy12,
    ];
    for (const fixture of all) {
      const parsed = WorkoutSchema.parse(fixture);
      expect(parsed.schema_version).toBe("1");
    }
  });

  // ── D-25a video_url field (Phase 2 — required-nullable, not optional) ────
  it("video_url: null is accepted (required-nullable)", () => {
    // Pull a fixture that will have video_url after backfill; for now test directly
    const base = {
      schema_version: "1",
      workout_title: "Test Workout",
      creator_username: "testuser",
      target_muscles: [],
      estimated_duration_mins: 30,
      difficulty: "beginner",
      extraction_confidence: "high",
      video_url: null,
      routine: [
        {
          type: "standard_set",
          exercise_name: "Push-Up",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          form_cues: [],
          startTimestamp: null,
          sourceQuote: null,
          equipment: [],
        },
      ],
    } as const;
    expect(() => WorkoutSchema.parse(base)).not.toThrow();
    const parsed = WorkoutSchema.parse(base);
    expect(parsed.video_url).toBeNull();
  });

  it("video_url: valid URL is accepted", () => {
    const base = {
      schema_version: "1",
      workout_title: "Test Workout",
      creator_username: "testuser",
      target_muscles: [],
      estimated_duration_mins: 30,
      difficulty: "beginner",
      extraction_confidence: "high",
      video_url: "https://youtube.com/watch?v=abc123",
      routine: [
        {
          type: "standard_set",
          exercise_name: "Push-Up",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          form_cues: [],
          startTimestamp: null,
          sourceQuote: null,
          equipment: [],
        },
      ],
    } as const;
    expect(() => WorkoutSchema.parse(base)).not.toThrow();
    const parsed = WorkoutSchema.parse(base);
    expect(parsed.video_url).toBe("https://youtube.com/watch?v=abc123");
  });

  it("video_url: invalid URL string is rejected", () => {
    const base = {
      schema_version: "1",
      workout_title: "Test Workout",
      creator_username: "testuser",
      target_muscles: [],
      estimated_duration_mins: 30,
      difficulty: "beginner",
      extraction_confidence: "high",
      video_url: "not-a-url",
      routine: [
        {
          type: "standard_set",
          exercise_name: "Push-Up",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          form_cues: [],
          startTimestamp: null,
          sourceQuote: null,
          equipment: [],
        },
      ],
    } as const;
    expect(() => WorkoutSchema.parse(base)).toThrow();
  });

  it("no .optional() or .nullish() in WorkoutSchema (Pitfall 2 — Structured Outputs)", () => {
    // This test ensures the schema tree stays free of .optional()/.nullish()
    // which break OpenAI Structured Outputs with NoObjectGeneratedError.
    // The actual grep check is done in the verification step.
    // Here we verify video_url is required (presence enforced by Zod — omitting it throws).
    const baseWithoutVideoUrl = {
      schema_version: "1",
      workout_title: "Test Workout",
      creator_username: "testuser",
      target_muscles: [],
      estimated_duration_mins: 30,
      difficulty: "beginner",
      extraction_confidence: "high",
      // video_url intentionally omitted — should throw (required-nullable)
      routine: [
        {
          type: "standard_set",
          exercise_name: "Push-Up",
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          form_cues: [],
          startTimestamp: null,
          sourceQuote: null,
          equipment: [],
        },
      ],
    };
    expect(() => WorkoutSchema.parse(baseWithoutVideoUrl)).toThrow();
  });
});
