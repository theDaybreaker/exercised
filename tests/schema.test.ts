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
});
