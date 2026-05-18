// Source: RESEARCH Pattern 5 + orchestrator note (Gemini 2.5 Flash swap)
// AI SDK 6 canonical API: generateText + Output.object() — NOT generateObject
// Provider: @ai-sdk/google (google("gemini-2.5-flash")) — GOOGLE_GENERATIVE_AI_API_KEY env var
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { WorkoutSchema } from "@/lib/schema/workout";
import type { Workout } from "@/lib/schema/workout";

/**
 * System prompt for workout extraction.
 * Instructs the LLM to:
 *  - Only extract explicitly mentioned exercises (D-22 hallucination prevention)
 *  - Provide verbatim sourceQuote for each exercise (EXTR-03)
 *  - Return extraction_confidence "low" for non-fitness content (D-23a)
 *  - Handle timed exercises (HIIT, yoga) and uncertain sets/reps
 */
export const EXTRACTION_SYSTEM_PROMPT = `
You are a fitness content analyzer. Extract a structured workout routine from the YouTube video transcript provided.

Rules:
1. Only extract exercises that are explicitly mentioned in the transcript. Do not invent exercises.
2. For each exercise, provide a sourceQuote: a verbatim phrase (3-10 words) from the transcript that confirms this exercise exists. Copy it exactly as it appears in the transcript, including any transcription artifacts.
3. If the transcript does not contain a fitness workout routine (cooking, gaming, lifestyle, etc.), set extraction_confidence to "low" and return an empty routine array.
4. If the transcript is unclear, partial, or ambiguous, set extraction_confidence to "low".
5. For timed exercises (HIIT, yoga), use reps like "30 seconds" or "AMRAP".
6. Estimate sets/reps/rest from context; use reasonable defaults (3 sets, 10 reps) only when clearly implied.
7. The workout_title should be descriptive of the video content.
8. creator_username: use the handle/name mentioned in the video, or "unknown" if not mentioned.

Return a complete, valid workout matching the schema. If no workout found, return extraction_confidence "low" with empty routine.
`.trim();

/**
 * Calls Gemini 2.5 Flash via Vercel AI SDK to extract a structured workout
 * from a YouTube video transcript.
 *
 * Uses generateText + Output.object() per AI SDK 6 canonical API (RESEARCH Pattern 5).
 * Gemini's structured outputs follow grammar-level schema enforcement similar to
 * OpenAI's Structured Outputs mode.
 *
 * @param transcript - Full caption/transcript text from the YouTube video
 * @param videoUrl - Original YouTube URL for D-25b video_url field population
 * @returns Validated Workout object with video_url merged in
 */
export async function extractWorkout(
  transcript: string,
  videoUrl: string,
): Promise<Workout> {
  const { experimental_output } = await generateText({
    model: google("gemini-2.5-flash"),
    output: Output.object({ schema: WorkoutSchema }),
    maxRetries: 2, // Retries on network/rate errors; NoObjectGeneratedError is immediate
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Extract a structured workout from the following YouTube video transcript:\n\n${transcript}`,
  });

  // Merge videoUrl into result per D-25b
  // experimental_output is typed as Workout (inferred from WorkoutSchema)
  return { ...experimental_output, video_url: videoUrl };
}
