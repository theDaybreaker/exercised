import { describe, it, expect } from "vitest";
import { parseYouTubeUrl } from "@/lib/youtube/url";

describe("parseYouTubeUrl", () => {
  it("should parse standard youtube.com watch URL", () => {
    const result = parseYouTubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(result.isValid).toBe(true);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.cleaned).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  it("should parse youtu.be short URL and strip tracking params", () => {
    const result = parseYouTubeUrl(
      "https://youtu.be/dQw4w9WgXcQ?si=abc&t=10"
    );
    expect(result.isValid).toBe(true);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.cleaned).not.toContain("si=");
    expect(result.cleaned).not.toContain("t=10");
  });

  it("should parse youtube.com/shorts URL", () => {
    const result = parseYouTubeUrl(
      "https://youtube.com/shorts/aBcDeFgHiJk"
    );
    expect(result.isValid).toBe(true);
    expect(result.videoId).toBe("aBcDeFgHiJk");
  });

  it("should reject non-YouTube URLs", () => {
    const result = parseYouTubeUrl("https://vimeo.com/123");
    expect(result.isValid).toBe(false);
    expect(result.videoId).toBeNull();
  });

  it("should trim whitespace from input", () => {
    const result = parseYouTubeUrl(
      "  https://www.youtube.com/watch?v=dQw4w9WgXcQ  "
    );
    expect(result.isValid).toBe(true);
    expect(result.videoId).toBe("dQw4w9WgXcQ");
  });

  it("should strip utm_source and utm_medium tracking params", () => {
    const result = parseYouTubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=twitter&utm_medium=social"
    );
    expect(result.isValid).toBe(true);
    expect(result.cleaned).not.toContain("utm_source");
    expect(result.cleaned).not.toContain("utm_medium");
  });
});
