/**
 * tests/error-state.test.ts
 *
 * Structural/content tests for ErrorState component and URL validation polish.
 * These tests verify the component files contain the required content per plan
 * acceptance criteria (grep-based assertions done in code form).
 *
 * Note: Full React component rendering tests require jsdom setup — these tests
 * verify the module structure and content as specified in the acceptance criteria.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());

function readFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("ErrorState component — structure and content", () => {
  it("ErrorState.tsx exists in components/extract/", () => {
    expect(() => readFile("components/extract/ErrorState.tsx")).not.toThrow();
  });

  it("ErrorState has role='alert' on the card", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain('role="alert"');
  });

  it("ErrorState has verbatim NETWORK heading from UI-SPEC §7.4", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("Something went wrong on our end.");
  });

  it("ErrorState has verbatim NO_WORKOUT heading from UI-SPEC §7.4", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("No workout in this video.");
  });

  it("ErrorState has verbatim RATE_LIMITED heading from UI-SPEC §7.4", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("Slow down for a moment.");
  });

  it("ErrorState has all 3 CTA labels", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("Try again");
    expect(content).toContain("Try another URL");
    expect(content).toContain("Got it");
  });

  it("ErrorState CTA button meets 44px touch-target (h-11 or size='lg')", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    const has44px = content.includes("h-11") || content.includes("h-14") || content.includes('size="lg"');
    expect(has44px).toBe(true);
  });
});

describe("UrlInput — inline validation polish (INPT-02 + WCAG)", () => {
  it("UrlInput has aria-invalid attribute", () => {
    const content = readFile("components/extract/UrlInput.tsx");
    expect(content).toContain("aria-invalid");
  });

  it("UrlInput has aria-describedby attribute", () => {
    const content = readFile("components/extract/UrlInput.tsx");
    expect(content).toContain("aria-describedby");
  });

  it("UrlInput has url-error element with id", () => {
    const content = readFile("components/extract/UrlInput.tsx");
    expect(content).toContain('id="url-error"');
  });

  it("UrlInput has verbatim error message from UI-SPEC §7.1", () => {
    const content = readFile("components/extract/UrlInput.tsx");
    expect(content).toContain("That doesn't look like a YouTube link");
  });
});

describe("ExtractFlow — wires error state to ErrorState component", () => {
  it("ExtractFlow imports ErrorState", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    expect(content).toContain("ErrorState");
  });

  it("ExtractFlow renders ErrorState at least once (import + usage)", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    const count = (content.match(/ErrorState/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
