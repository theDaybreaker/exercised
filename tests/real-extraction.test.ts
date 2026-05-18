/**
 * tests/real-extraction.test.ts
 *
 * Vitest tests for RealExtractionService (TDD — Phase 2, Plan 04, Task 1).
 *
 * All external dependencies are mocked:
 *   - lib/youtube/captions → getCaptions
 *   - lib/ai/extract → extractWorkout
 *   - lib/guards/sourceQuote → validateSourceQuotes
 *
 * Tests verify:
 * (a) Successful extraction emits 4 stage events + 1 result event
 * (b) Failed captions (null) → fetching stage + error "NO_WORKOUT"
 * (c) extractWorkout throw → error "NETWORK"
 * (d) Low-confidence triggers: extraction_confidence "low" → lowConfidence: true
 * (e) Low-confidence triggers: routine < 3 exercises → lowConfidence: true (D-23b)
 * (f) Low-confidence triggers: transcript < 200 words → lowConfidence: true (D-23c)
 * (g) Low-confidence triggers: droppedCount > 0 → lowConfidence: true (D-23d)
 * (h) High-confidence result → lowConfidence: false (or undefined)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies BEFORE importing the module under test
vi.mock("@/lib/youtube/captions", () => ({
  getCaptions: vi.fn(),
}));
vi.mock("@/lib/ai/extract", () => ({
  extractWorkout: vi.fn(),
}));
vi.mock("@/lib/guards/sourceQuote", () => ({
  validateSourceQuotes: vi.fn(),
}));

import { getCaptions } from "@/lib/youtube/captions";
import { extractWorkout } from "@/lib/ai/extract";
import { validateSourceQuotes } from "@/lib/guards/sourceQuote";
import { RealExtractionService } from "@/lib/extraction/real";
import type { Workout } from "@/lib/schema/workout";

// Helpers
const mockGetCaptions = getCaptions as ReturnType<typeof vi.fn>;
const mockExtractWorkout = extractWorkout as ReturnType<typeof vi.fn>;
const mockValidateSourceQuotes = validateSourceQuotes as ReturnType<typeof vi.fn>;

const VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/** A minimal workout with high confidence and ≥3 exercises */
const HIGH_CONFIDENCE_WORKOUT: Workout = {
  schema_version: "1",
  workout_title: "Test Leg Day",
  creator_username: "testcoach",
  target_muscles: ["Quads", "Glutes"],
  estimated_duration_mins: 40,
  difficulty: "intermediate",
  extraction_confidence: "high",
  video_url: VALID_URL,
  routine: [
    {
      type: "standard_set",
      exercise_name: "Squat",
      sets: 3,
      reps: "10",
      rest_seconds: 60,
      form_cues: ["keep chest up"],
      startTimestamp: null,
      sourceQuote: "squat down",
      equipment: [],
    },
    {
      type: "standard_set",
      exercise_name: "Lunge",
      sets: 3,
      reps: "12",
      rest_seconds: 60,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: "lunge forward",
      equipment: [],
    },
    {
      type: "standard_set",
      exercise_name: "Deadlift",
      sets: 4,
      reps: "8",
      rest_seconds: 90,
      form_cues: [],
      startTimestamp: null,
      sourceQuote: "deadlift the bar",
      equipment: [],
    },
  ],
};

/** A transcript with ≥200 words */
const LONG_TRANSCRIPT = "word ".repeat(210).trim();

/** A transcript with <200 words */
const SHORT_TRANSCRIPT = "word ".repeat(50).trim();

async function collectEvents(url: string) {
  const events: Array<Record<string, unknown>> = [];
  for await (const event of RealExtractionService.extract(url)) {
    events.push(event as Record<string, unknown>);
  }
  return events;
}

describe("RealExtractionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("emits 4 stage events then 1 result event on success", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);

    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
    expect(events[1]).toMatchObject({ type: "stage", stage: "transcribing" });
    expect(events[2]).toMatchObject({ type: "stage", stage: "analyzing" });
    expect(events[3]).toMatchObject({ type: "stage", stage: "generating" });
    expect(events[4]).toMatchObject({ type: "result" });
  });

  it("result event includes the validated workout", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect(result).toBeDefined();
    expect((result as { workout: Workout }).workout.workout_title).toBe(
      "Test Leg Day"
    );
  });

  it("result event has lowConfidence: false when all 4 D-23 signals are negative", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect((result as { lowConfidence?: boolean }).lowConfidence).toBe(false);
  });

  // ── getCaptions returns null → NO_WORKOUT ──────────────────────────────

  it("emits fetching stage then NO_WORKOUT error when captions are null", async () => {
    mockGetCaptions.mockResolvedValueOnce(null);

    const events = await collectEvents(VALID_URL);

    // Should emit fetching stage first, then error
    expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toMatchObject({
      type: "error",
      code: "NO_WORKOUT",
    });
    // No result event
    expect(events.find((e) => e.type === "result")).toBeUndefined();
  });

  it("does NOT call extractWorkout when captions are null", async () => {
    mockGetCaptions.mockResolvedValueOnce(null);

    await collectEvents(VALID_URL);

    expect(mockExtractWorkout).not.toHaveBeenCalled();
  });

  // ── extractWorkout throws → NETWORK error ──────────────────────────────

  it("emits NETWORK error when extractWorkout throws", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockRejectedValueOnce(new Error("AI API timeout"));

    const events = await collectEvents(VALID_URL);

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent).toMatchObject({
      type: "error",
      code: "NETWORK",
    });
    // No result event
    expect(events.find((e) => e.type === "result")).toBeUndefined();
  });

  // ── Low-confidence triggers (D-23) ─────────────────────────────────────

  it("D-23a: lowConfidence: true when extraction_confidence is 'low'", async () => {
    const lowConfidenceWorkout: Workout = {
      ...HIGH_CONFIDENCE_WORKOUT,
      extraction_confidence: "low",
    };

    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(lowConfidenceWorkout);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: lowConfidenceWorkout,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect((result as { lowConfidence?: boolean }).lowConfidence).toBe(true);
  });

  it("D-23b: lowConfidence: true when routine.length < 3", async () => {
    const twoExerciseWorkout: Workout = {
      ...HIGH_CONFIDENCE_WORKOUT,
      extraction_confidence: "high",
      routine: HIGH_CONFIDENCE_WORKOUT.routine.slice(0, 2),
    };

    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(twoExerciseWorkout);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: twoExerciseWorkout,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect((result as { lowConfidence?: boolean }).lowConfidence).toBe(true);
  });

  it("D-23c: lowConfidence: true when transcript has < 200 words", async () => {
    mockGetCaptions.mockResolvedValueOnce(SHORT_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect((result as { lowConfidence?: boolean }).lowConfidence).toBe(true);
  });

  it("D-23d: lowConfidence: true when droppedCount > 0", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    // validateSourceQuotes drops 1 exercise
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 1,
    });

    const events = await collectEvents(VALID_URL);
    const result = events.find((e) => e.type === "result");

    expect((result as { lowConfidence?: boolean }).lowConfidence).toBe(true);
  });

  // ── extractWorkout is called with transcript + url ─────────────────────

  it("calls extractWorkout with the transcript and original URL", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    await collectEvents(VALID_URL);

    expect(mockExtractWorkout).toHaveBeenCalledWith(LONG_TRANSCRIPT, VALID_URL);
  });

  it("calls validateSourceQuotes with the workout and transcript", async () => {
    mockGetCaptions.mockResolvedValueOnce(LONG_TRANSCRIPT);
    mockExtractWorkout.mockResolvedValueOnce(HIGH_CONFIDENCE_WORKOUT);
    mockValidateSourceQuotes.mockReturnValueOnce({
      workout: HIGH_CONFIDENCE_WORKOUT,
      droppedCount: 0,
    });

    await collectEvents(VALID_URL);

    expect(mockValidateSourceQuotes).toHaveBeenCalledWith(
      HIGH_CONFIDENCE_WORKOUT,
      LONG_TRANSCRIPT
    );
  });
});
