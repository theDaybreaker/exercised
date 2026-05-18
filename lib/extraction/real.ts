import type { ExtractionService } from "./service";
import type { ExtractEvent } from "@/lib/schema/workout";
import { parseYouTubeUrl } from "@/lib/youtube/url";
import { getCaptions } from "@/lib/youtube/captions";
import { extractWorkout } from "@/lib/ai/extract";
import { validateSourceQuotes } from "@/lib/guards/sourceQuote";

/**
 * RealExtractionService — captions-first pipeline (Phase 2).
 *
 * Pipeline:
 * 1. Parse videoId from URL — yield NETWORK error on invalid URL.
 * 2. Yield stage "fetching".
 * 3. getCaptions(videoId) — yield NO_WORKOUT error if null.
 * 4. Compute wordCount for D-23c low-confidence signal.
 * 5. Yield stage "transcribing".
 * 6. Yield stage "analyzing".
 * 7. extractWorkout(transcript, url) — yield NETWORK error on throw.
 * 8. validateSourceQuotes(workout, transcript) → { workout, droppedCount }.
 * 9. Yield stage "generating".
 * 10. Compute lowConfidence from all 4 D-23 signals.
 * 11. Yield result { workout, lowConfidence }.
 *
 * NOTE: Cache reads/writes and rate-limit/spend checks are route.ts concerns.
 * This service is a pure extraction pipeline — no Redis interaction here.
 */
export const RealExtractionService: ExtractionService = {
  async *extract(url: string): AsyncIterable<ExtractEvent> {
    // Step 1: Parse URL for videoId
    const { videoId, isValid } = parseYouTubeUrl(url);
    if (!isValid || !videoId) {
      yield {
        type: "error",
        code: "NETWORK",
        message: "Invalid YouTube URL — could not extract video ID.",
      };
      return;
    }

    // Step 2: Stage "fetching"
    yield { type: "stage", stage: "fetching" };

    // Step 3: Fetch captions
    const transcript = await getCaptions(videoId);
    if (!transcript) {
      yield {
        type: "error",
        code: "NO_WORKOUT",
        message: "We couldn't find captions for this video.",
      };
      return;
    }

    // Step 4: Compute wordCount for D-23c
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;

    // Step 5: Stage "transcribing"
    yield { type: "stage", stage: "transcribing" };

    // Step 6: Stage "analyzing"
    yield { type: "stage", stage: "analyzing" };

    // Step 7: Extract workout via LLM
    let rawWorkout;
    try {
      rawWorkout = await extractWorkout(transcript, url);
    } catch {
      yield {
        type: "error",
        code: "NETWORK",
        message: "Extraction failed. The AI service may be temporarily unavailable.",
      };
      return;
    }

    // Step 8: Validate sourceQuotes — drops hallucinated exercises (D-22)
    const { workout: filteredWorkout, droppedCount } = validateSourceQuotes(
      rawWorkout,
      transcript
    );

    // Step 9: Stage "generating"
    yield { type: "stage", stage: "generating" };

    // Step 10: Compute lowConfidence from all 4 D-23 signals
    const lowConfidence =
      filteredWorkout.extraction_confidence === "low" || // D-23a
      filteredWorkout.routine.length < 3 ||              // D-23b
      wordCount < 200 ||                                  // D-23c
      droppedCount > 0;                                   // D-23d

    // Step 11: Emit result
    yield {
      type: "result",
      workout: filteredWorkout,
      lowConfidence,
    };
  },
};
