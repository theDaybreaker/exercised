/**
 * tests/extract-flow-preflight.test.ts
 *
 * TDD tests for the ExtractFlow.tsx HTTP pre-flight handling (Plan 02-04, Task 3).
 *
 * Tests focus on:
 * (a) Reducer handles BUDGET_EXHAUSTED error code (requires reducer update)
 * (b) Reducer success action supports lowConfidence and cached fields (for WorkoutView Plan 02-05)
 * (c) ErrorState renders BUDGET_EXHAUSTED (uses existing UNKNOWN fallback or dedicated config)
 *
 * Note: Full React component integration tests (fetch mocking + SSE reader) require
 * React Testing Library which is not installed. These tests cover the pure-function
 * logic (reducer) and component rendering logic that the ExtractFlow changes depend on.
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
  video_url: null as string | null,
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

describe("Reducer — BUDGET_EXHAUSTED error code (Plan 02-04 Task 3)", () => {
  it("accepts BUDGET_EXHAUSTED as a valid error code", () => {
    const result = reducer(initialState, {
      type: "error",
      code: "BUDGET_EXHAUSTED",
      message: "We're popular today — try again tomorrow.",
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.code).toBe("BUDGET_EXHAUSTED");
      expect(result.message).toBe("We're popular today — try again tomorrow.");
    }
  });

  it("BUDGET_EXHAUSTED error transitions from submitting state", () => {
    const submitting = reducer(initialState, {
      type: "submit",
      url: "https://youtube.com/watch?v=abc",
    });
    const result = reducer(submitting, {
      type: "error",
      code: "BUDGET_EXHAUSTED",
      message: "Budget exhausted.",
    });
    expect(result.kind).toBe("error");
  });
});

describe("Reducer — success action with lowConfidence and cached (Plan 02-04 Task 3)", () => {
  it("success action accepts lowConfidence: true and stores it in state", () => {
    const result = reducer(initialState, {
      type: "success",
      workout: VALID_WORKOUT,
      lowConfidence: true,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.lowConfidence).toBe(true);
    }
  });

  it("success action accepts lowConfidence: false and stores it in state", () => {
    const result = reducer(initialState, {
      type: "success",
      workout: VALID_WORKOUT,
      lowConfidence: false,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.lowConfidence).toBe(false);
    }
  });

  it("success action accepts cached: true and stores it in state", () => {
    const result = reducer(initialState, {
      type: "success",
      workout: VALID_WORKOUT,
      cached: true,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.cached).toBe(true);
    }
  });

  it("success action defaults cached to false when not provided", () => {
    const result = reducer(initialState, {
      type: "success",
      workout: VALID_WORKOUT,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      // cached should be false or undefined (falsy)
      expect(result.cached).toBeFalsy();
    }
  });

  it("success action defaults lowConfidence to false when not provided", () => {
    const result = reducer(initialState, {
      type: "success",
      workout: VALID_WORKOUT,
    });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      // lowConfidence should be false or undefined (falsy)
      expect(result.lowConfidence).toBeFalsy();
    }
  });
});
