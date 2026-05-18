/**
 * Unit tests for lib/youtube/captions.ts
 *
 * Both youtube-caption-extractor and youtube-transcript are mocked.
 * Tests verify:
 *  - Primary (getVideoDetails) success returns joined subtitle text
 *  - Primary returns empty subtitles[] → falls back to YoutubeTranscript
 *  - Primary throws → falls back to YoutubeTranscript
 *  - Both fail → returns null (no throw)
 *  - Fallback success returns joined transcript text
 *  - Empty transcript from fallback (length 0) returns null
 *  - Empty videoId does not throw
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock youtube-caption-extractor
const mockGetVideoDetails = vi.fn();

vi.mock("youtube-caption-extractor", () => ({
  getVideoDetails: mockGetVideoDetails,
}));

// Mock youtube-transcript
const mockFetchTranscript = vi.fn();

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: mockFetchTranscript,
  },
}));

describe("lib/youtube/captions — getCaptions()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("primary path (youtube-caption-extractor)", () => {
    it("returns joined subtitle text when getVideoDetails succeeds with subtitles", async () => {
      mockGetVideoDetails.mockResolvedValue({
        subtitles: [
          { text: "Hello" },
          { text: "World" },
          { text: "Workout" },
        ],
      });
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("dQw4w9WgXcQ");
      expect(result).toBe("Hello World Workout");
    });

    it("calls getVideoDetails with { videoID, lang: 'en' }", async () => {
      mockGetVideoDetails.mockResolvedValue({
        subtitles: [{ text: "Squats" }],
      });
      const { getCaptions } = await import("@/lib/youtube/captions");
      await getCaptions("abc123");
      expect(mockGetVideoDetails).toHaveBeenCalledWith({
        videoID: "abc123",
        lang: "en",
      });
    });

    it("does not call fallback when primary succeeds with non-empty subtitles", async () => {
      mockGetVideoDetails.mockResolvedValue({
        subtitles: [{ text: "Bench Press" }],
      });
      const { getCaptions } = await import("@/lib/youtube/captions");
      await getCaptions("abc123");
      expect(mockFetchTranscript).not.toHaveBeenCalled();
    });
  });

  describe("fallback path (youtube-transcript)", () => {
    it("falls back to YoutubeTranscript when getVideoDetails returns empty subtitles array", async () => {
      mockGetVideoDetails.mockResolvedValue({ subtitles: [] });
      mockFetchTranscript.mockResolvedValue([
        { text: "Do squats" },
        { text: "3 sets of 10" },
      ]);
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("abc123");
      expect(result).toBe("Do squats 3 sets of 10");
    });

    it("falls back to YoutubeTranscript when getVideoDetails throws", async () => {
      mockGetVideoDetails.mockRejectedValue(new Error("Network error"));
      mockFetchTranscript.mockResolvedValue([
        { text: "Deadlifts" },
        { text: "4 sets of 5" },
      ]);
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("abc123");
      expect(result).toBe("Deadlifts 4 sets of 5");
    });

    it("calls YoutubeTranscript.fetchTranscript with the videoId", async () => {
      mockGetVideoDetails.mockResolvedValue({ subtitles: [] });
      mockFetchTranscript.mockResolvedValue([{ text: "Pull-ups" }]);
      const { getCaptions } = await import("@/lib/youtube/captions");
      await getCaptions("myVideoId");
      expect(mockFetchTranscript).toHaveBeenCalledWith("myVideoId");
    });
  });

  describe("failure cases", () => {
    it("returns null when both primary returns empty and fallback throws", async () => {
      mockGetVideoDetails.mockResolvedValue({ subtitles: [] });
      mockFetchTranscript.mockRejectedValue(new Error("Transcript unavailable"));
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("abc123");
      expect(result).toBeNull();
    });

    it("returns null when primary throws and fallback also throws", async () => {
      mockGetVideoDetails.mockRejectedValue(new Error("API error"));
      mockFetchTranscript.mockRejectedValue(new Error("No transcript"));
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("abc123");
      expect(result).toBeNull();
    });

    it("returns null when fallback returns empty array (length 0)", async () => {
      mockGetVideoDetails.mockResolvedValue({ subtitles: [] });
      mockFetchTranscript.mockResolvedValue([]);
      const { getCaptions } = await import("@/lib/youtube/captions");
      const result = await getCaptions("abc123");
      expect(result).toBeNull();
    });

    it("does not throw with empty videoId — returns null", async () => {
      mockGetVideoDetails.mockRejectedValue(new Error("Invalid videoId"));
      mockFetchTranscript.mockRejectedValue(new Error("Invalid videoId"));
      const { getCaptions } = await import("@/lib/youtube/captions");
      await expect(getCaptions("")).resolves.toBeNull();
    });
  });
});
