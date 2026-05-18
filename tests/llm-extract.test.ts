/**
 * Unit tests for lib/ai/extract.ts
 *
 * "ai" (generateText, Output) and "@ai-sdk/google" are mocked.
 * Tests verify:
 *  - extractWorkout calls generateText (not generateObject)
 *  - extractWorkout uses google("gemini-2.5-flash") model
 *  - extractWorkout merges videoUrl into the returned workout (D-25b)
 *  - EXTRACTION_SYSTEM_PROMPT is exported and non-empty
 *  - extractWorkout resolves to a WorkoutSchema-valid object
 *  - extractWorkout with empty transcript still calls generateText
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkoutSchema } from "@/lib/schema/workout";

// Minimal valid Workout fixture (without video_url — extractWorkout merges it)
const VALID_WORKOUT_FIXTURE = {
  schema_version: "1" as const,
  workout_title: "Dumbbell Leg Day",
  creator_username: "fitnesscoach",
  target_muscles: ["quads", "glutes", "hamstrings"],
  estimated_duration_mins: 45,
  difficulty: "intermediate" as const,
  extraction_confidence: "high" as const,
  video_url: null,
  routine: [
    {
      type: "standard_set" as const,
      exercise_name: "Goblet Squat",
      sets: 3,
      reps: "12",
      rest_seconds: 60,
      form_cues: ["Keep chest up", "Drive knees out"],
      startTimestamp: null,
      sourceQuote: "goblet squats for 12 reps",
      equipment: ["dumbbell"],
    },
  ],
};

// Mock generateText from "ai"
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateText: mockGenerateText,
  Output: {
    object: vi.fn((opts) => opts), // returns the options object for inspection
  },
}));

// Mock google from "@ai-sdk/google"
const mockGoogle = vi.fn((modelId: string) => ({ provider: "google", modelId }));

vi.mock("@ai-sdk/google", () => ({
  google: mockGoogle,
}));

describe("lib/ai/extract — extractWorkout()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("EXTRACTION_SYSTEM_PROMPT", () => {
    it("is exported and non-empty", async () => {
      const { EXTRACTION_SYSTEM_PROMPT } = await import("@/lib/ai/extract");
      expect(EXTRACTION_SYSTEM_PROMPT).toBeTruthy();
      expect(typeof EXTRACTION_SYSTEM_PROMPT).toBe("string");
      expect(EXTRACTION_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    });

    it("mentions sourceQuote requirement", async () => {
      const { EXTRACTION_SYSTEM_PROMPT } = await import("@/lib/ai/extract");
      expect(EXTRACTION_SYSTEM_PROMPT.toLowerCase()).toContain("sourcequote");
    });

    it("mentions extraction_confidence guidance", async () => {
      const { EXTRACTION_SYSTEM_PROMPT } = await import("@/lib/ai/extract");
      expect(EXTRACTION_SYSTEM_PROMPT.toLowerCase()).toContain(
        "extraction_confidence",
      );
    });
  });

  describe("extractWorkout", () => {
    it("calls generateText (not generateObject)", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      await extractWorkout("Do squats 3 sets of 10", "https://youtube.com/watch?v=abc123");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("uses google('gemini-2.5-flash') as the model", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      await extractWorkout("some transcript", "https://youtube.com/watch?v=xyz");
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(mockGoogle).toHaveBeenCalledWith("gemini-2.5-flash");
      expect(callArgs.model).toEqual({ provider: "google", modelId: "gemini-2.5-flash" });
    });

    it("merges videoUrl argument into returned workout (D-25b)", async () => {
      const videoUrl = "https://youtube.com/watch?v=abc123";
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      const result = await extractWorkout("some transcript", videoUrl);
      expect(result.video_url).toBe(videoUrl);
    });

    it("passes EXTRACTION_SYSTEM_PROMPT as system parameter", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout, EXTRACTION_SYSTEM_PROMPT } = await import("@/lib/ai/extract");
      await extractWorkout("some transcript", "https://youtube.com/watch?v=abc");
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.system).toBe(EXTRACTION_SYSTEM_PROMPT);
    });

    it("includes the transcript in the prompt", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const transcript = "Bench press 4 sets of 8 reps";
      const { extractWorkout } = await import("@/lib/ai/extract");
      await extractWorkout(transcript, "https://youtube.com/watch?v=abc");
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain(transcript);
    });

    it("resolves to a WorkoutSchema-valid object", async () => {
      const videoUrl = "https://youtube.com/watch?v=abc123";
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      const result = await extractWorkout("some transcript", videoUrl);
      // Should not throw
      expect(() => WorkoutSchema.parse(result)).not.toThrow();
    });

    it("still calls generateText with empty transcript (LLM decides if it's a workout)", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      await extractWorkout("", "https://youtube.com/watch?v=empty");
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it("uses Output.object with WorkoutSchema for structured output", async () => {
      mockGenerateText.mockResolvedValue({
        experimental_output: { ...VALID_WORKOUT_FIXTURE, video_url: null },
      });
      const { extractWorkout } = await import("@/lib/ai/extract");
      await extractWorkout("transcript text", "https://youtube.com/watch?v=abc");
      const callArgs = mockGenerateText.mock.calls[0][0];
      // Output.object is called with { schema: WorkoutSchema } — our mock returns the opts
      expect(callArgs.output).toBeDefined();
    });
  });
});
