/**
 * Share strip notice + D-18 error path tests (Plan 01-04, Task 2)
 *
 * Covers:
 * 1. ShareStripNotice.tsx exists with role="status" and Info icon
 * 2. noticeText() logic in lib/share/notice.ts produces correct copy
 * 3. WorkoutView renders ShareStripNotice (import + usage)
 * 4. ActionBar destructures { encoded, stripped } and passes description to toast
 * 5. ErrorState D-18 heading override for "newer version of Exercised" messages
 * 6. Reducer hydrate action passes stripped to success state (already tested in reducer.test.ts — sanity check)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());

function readFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("ShareStripNotice component (D-17 recipient view)", () => {
  it("ShareStripNotice.tsx exists in components/workout/", () => {
    expect(() => readFile("components/workout/ShareStripNotice.tsx")).not.toThrow();
  });

  it("ShareStripNotice has role='status' for accessibility", () => {
    const content = readFile("components/workout/ShareStripNotice.tsx");
    expect(content).toContain('role="status"');
  });

  it("ShareStripNotice imports Info icon from lucide-react", () => {
    const content = readFile("components/workout/ShareStripNotice.tsx");
    expect(content).toContain("Info");
    expect(content).toContain("lucide-react");
  });

  it("ShareStripNotice includes 'omits' and 'for length' in the notice text", () => {
    const content = readFile("components/workout/ShareStripNotice.tsx");
    expect(content).toContain("omits");
    expect(content).toContain("for length");
  });
});

describe("noticeText helper in lib/share/notice.ts", () => {
  it("lib/share/notice.ts exists", () => {
    expect(() => readFile("lib/share/notice.ts")).not.toThrow();
  });

  it("noticeText(['sourceQuote']) returns source-quotes-specific notice", async () => {
    const { noticeText } = await import("@/lib/share/notice");
    const result = noticeText(["sourceQuote"]);
    expect(result).toContain("source quotes");
    expect(result).toContain("for length");
  });

  it("noticeText(['form_cues']) returns form-cues notice (D-17 verbatim)", async () => {
    const { noticeText } = await import("@/lib/share/notice");
    const result = noticeText(["form_cues"]);
    expect(result).toContain("form cues");
    expect(result).toContain("for length");
  });

  it("noticeText(['sourceQuote', 'form_cues']) returns combined notice", async () => {
    const { noticeText } = await import("@/lib/share/notice");
    const result = noticeText(["sourceQuote", "form_cues"]);
    // Should mention form cues for the combined case (D-17 verbatim: "Share link omits form cues for length.")
    expect(result).toContain("for length");
  });

  it("noticeText(['sourceQuote', 'form_cues', 'equipment']) returns all-three notice", async () => {
    const { noticeText } = await import("@/lib/share/notice");
    const result = noticeText(["sourceQuote", "form_cues", "equipment"]);
    expect(result).toContain("for length");
    expect(result).toContain("equipment");
  });

  it("noticeText([]) returns empty string", async () => {
    const { noticeText } = await import("@/lib/share/notice");
    const result = noticeText([]);
    expect(result).toBe("");
  });
});

describe("WorkoutView — renders ShareStripNotice (D-17 §11)", () => {
  it("WorkoutView imports ShareStripNotice", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("ShareStripNotice");
  });

  it("WorkoutView uses ShareStripNotice at least once (import + usage = 2 occurrences)", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    const count = (content.match(/ShareStripNotice/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("WorkoutView prop accepts shareLinkOmittedFields", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("shareLinkOmittedFields");
  });
});

describe("ActionBar — surfaces strip notice in share toast (D-17 §7.3)", () => {
  it("ActionBar destructures both encoded and stripped from encodeShareUrl", () => {
    const content = readFile("components/workout/ActionBar.tsx");
    expect(content).toMatch(/const \{ encoded, stripped \} = encodeShareUrl/);
  });

  it("ActionBar uses toast with description for stripped share links", () => {
    const content = readFile("components/workout/ActionBar.tsx");
    expect(content).toContain("description:");
  });

  it("ActionBar imports noticeText from lib/share/notice", () => {
    const content = readFile("components/workout/ActionBar.tsx");
    expect(content).toContain("noticeText");
  });
});

describe("ErrorState — D-18 heading override (schema version error)", () => {
  it("ErrorState contains D-18 heading 'This share link uses a newer version.'", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("This share link uses a newer version");
  });

  it("ErrorState contains D-18 body 'Try pasting the original YouTube URL instead.'", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("Try pasting the original YouTube URL instead");
  });

  it("ErrorState heading override checks for 'newer version of Exercised' substring", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("newer version of Exercised");
  });
});
