/**
 * Reducer FSM tests (D-15, D-16, D-19)
 *
 * The reducer is a pure function — no side effects, no async, no imports from
 * the DOM or Next.js runtime. Tests run in the Vitest node environment.
 */
import { describe, it, expect } from "vitest";
import { reducer, initialState } from "@/components/extract/reducer";

const VALID_WORKOUT = {
  schema_version: "1" as const,
  workout_title: "Test Workout",
  creator_username: "testuser",
  target_muscles: ["Quads"],
  estimated_duration_mins: 30,
  difficulty: "intermediate" as const,
  extraction_confidence: "high" as const,
  routine: [
    {
      type: "standard_set" as const,
      exercise_name: "Squat",
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

describe("reducer FSM (D-15, D-16, D-19)", () => {
  it("submit: idle → submitting with url", () => {
    const result = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=x",
    });
    expect(result.kind).toBe("submitting");
    if (result.kind === "submitting") {
      expect(result.url).toBe("https://youtube.com/watch?v=x");
    }
  });

  it("stage: submitting → streaming with currentStage and completedStages", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    const result = reducer(submitting, {
      type: "stage",
      stage: "transcribing",
    });
    expect(result.kind).toBe("streaming");
    if (result.kind === "streaming") {
      expect(result.currentStage).toBe("transcribing");
      expect(result.completedStages).toContain("fetching");
      expect(result.completedStages).not.toContain("transcribing");
    }
  });

  it("success: streaming → success with workout and fromShareLink=false", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    const streaming = reducer(submitting, {
      type: "stage",
      stage: "generating",
    });
    const result = reducer(streaming, {
      type: "success",
      workout: VALID_WORKOUT,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.workout).toEqual(VALID_WORKOUT);
      expect(result.fromShareLink).toBe(false);
    }
  });

  it("hydrate: dispatches directly to success with fromShareLink=true and stripped=[]", () => {
    const result = reducer(initialState, {
      type: "hydrate",
      workout: VALID_WORKOUT,
      stripped: [],
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.workout).toEqual(VALID_WORKOUT);
      expect(result.fromShareLink).toBe(true);
      expect(result.stripped).toEqual([]);
    }
  });

  it("reset: any state → initialState (D-19)", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    const result = reducer(submitting, { type: "reset" });
    expect(result).toEqual(initialState);
    expect(result.kind).toBe("idle");
  });

  it("error: any state → error with code and message", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    const result = reducer(submitting, {
      type: "error",
      code: "NETWORK",
      message: "Network error",
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("NETWORK");
      expect(result.message).toBe("Network error");
    }
  });

  it("stage: out-of-order stage events produce consistent completedStages (fetching→analyzing skips transcribing)", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    // Skip directly to 'analyzing' — completedStages should include fetching AND transcribing
    const result = reducer(submitting, {
      type: "stage",
      stage: "analyzing",
    });
    expect(result.kind).toBe("streaming");
    if (result.kind === "streaming") {
      expect(result.completedStages).toContain("fetching");
      expect(result.completedStages).toContain("transcribing");
      expect(result.completedStages).not.toContain("analyzing");
    }
  });
});
