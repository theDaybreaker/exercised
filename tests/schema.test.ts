import { describe, it, expect } from "vitest";
import { WorkoutSchema } from "@/lib/schema/workout";
import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";

describe("WorkoutSchema", () => {
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
});
