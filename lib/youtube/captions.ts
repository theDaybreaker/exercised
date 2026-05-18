// Source: RESEARCH Pattern 8, Pitfall 1
// Primary: youtube-caption-extractor (getVideoDetails returns empty array on failure — no throw)
// Fallback: youtube-transcript (different internal client path — complementary failure modes)
// Returns null if both fail; route.ts treats null as NO_WORKOUT
import { getVideoDetails } from "youtube-caption-extractor";
import { YoutubeTranscript } from "youtube-transcript";

/**
 * Fetches YouTube captions using two complementary libraries.
 *
 * Primary: youtube-caption-extractor's getVideoDetails()
 *   - Returns { subtitles: [] } on failure (no throw) per Pitfall 1
 *   - Falls through to fallback on empty array or unexpected throw
 *
 * Fallback: youtube-transcript's YoutubeTranscript.fetchTranscript()
 *   - Different internal request path vs primary — complementary bot-detection resistance
 *   - Returns null if empty result or throw
 *
 * @param videoId - YouTube video ID (11-char alphanumeric string)
 * @returns Joined caption text or null if both libraries fail
 */
export async function getCaptions(videoId: string): Promise<string | null> {
  // Primary: youtube-caption-extractor
  try {
    const details = await getVideoDetails({ videoID: videoId, lang: "en" });
    if (details.subtitles.length > 0) {
      return details.subtitles.map((s: { text: string }) => s.text).join(" ");
    }
    // Empty array — fall through to fallback
  } catch {
    // Library threw — fall through to fallback
  }

  // Fallback: youtube-transcript
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcript.length > 0) {
      return transcript.map((t: { text: string }) => t.text).join(" ");
    }
    // Empty result — return null
  } catch {
    // Fallback also failed
  }

  return null; // Both libraries failed — route.ts emits NO_WORKOUT
}
