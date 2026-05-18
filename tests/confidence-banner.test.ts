/**
 * tests/confidence-banner.test.ts
 *
 * Structural and content tests for ConfidenceBanner (D-23) and its integration into
 * WorkoutView (D-23f), plus the BUDGET_EXHAUSTED ErrorState variant (D-20e) and
 * the cached badge wiring (D-26d).
 *
 * Uses file-content assertions (same pattern as error-state.test.ts) since jsdom
 * React component tests would require a full jsdom + React setup not in vitest.config.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());

function readFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

// ─── ConfidenceBanner component ─────────────────────────────────────────────

describe("ConfidenceBanner — structure and content (D-23)", () => {
  it("ConfidenceBanner.tsx exists in components/extract/", () => {
    expect(() => readFile("components/extract/ConfidenceBanner.tsx")).not.toThrow();
  });

  it("ConfidenceBanner has role='status' attribute (D-23f informational, non-interrupting)", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain('role="status"');
  });

  it("ConfidenceBanner contains D-23e copy: 'Heads up'", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("Heads up");
  });

  it("ConfidenceBanner contains D-23e copy about incomplete extraction", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("this extraction may be incomplete");
  });

  it("ConfidenceBanner contains D-23e copy about source video", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("source video for anything we missed");
  });

  it("ConfidenceBanner has a dismiss button that calls onDismiss (aria-label present)", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("onDismiss");
    expect(content).toContain("onClick");
  });

  it("ConfidenceBanner dismiss button has aria-label for accessibility", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("aria-label");
  });

  it("ConfidenceBanner is a 'use client' component", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain('"use client"');
  });

  it("ConfidenceBanner uses amber/yellow styling (NOT red)", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    // Should use amber color values (245, 158, 11 = amber-500) — not red (#ef4444/#dc2626)
    // The file may use either Tailwind amber classes or inline amber RGB values
    const hasAmberClass = content.includes("amber") || content.includes("245, 158, 11") || content.includes("217, 119, 6");
    expect(hasAmberClass).toBe(true);
    expect(content).not.toMatch(/#ef4444|#dc2626|rgb\(239/); // no red colors
  });

  it("ConfidenceBanner accepts onDismiss prop in props interface", () => {
    const content = readFile("components/extract/ConfidenceBanner.tsx");
    expect(content).toContain("onDismiss: () => void");
  });
});

// ─── WorkoutView integration (D-23f + D-26d) ────────────────────────────────

describe("WorkoutView — ConfidenceBanner + cached integration", () => {
  it("WorkoutView imports ConfidenceBanner", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("ConfidenceBanner");
  });

  it("WorkoutView accepts lowConfidence prop (D-23)", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("lowConfidence");
  });

  it("WorkoutView accepts cached prop (D-26d)", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("cached");
  });

  it("WorkoutView renders ConfidenceBanner conditionally", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    // Should have lowConfidence conditional rendering
    expect(content).toContain("lowConfidence && !bannerDismissed");
  });

  it("WorkoutView has banner dismiss state", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("bannerDismissed");
    expect(content).toContain("setBannerDismissed");
  });

  it("WorkoutView passes cached prop to WorkoutHeader", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("cached={cached}");
  });

  it("WorkoutView imports useState for banner dismiss state", () => {
    const content = readFile("components/workout/WorkoutView.tsx");
    expect(content).toContain("useState");
  });
});

// ─── WorkoutHeader cached badge (D-26d) ─────────────────────────────────────

describe("WorkoutHeader — Cached badge (D-26d)", () => {
  it("WorkoutHeader accepts cached prop", () => {
    const content = readFile("components/workout/WorkoutHeader.tsx");
    expect(content).toContain("cached");
  });

  it("WorkoutHeader imports Zap icon from lucide-react", () => {
    const content = readFile("components/workout/WorkoutHeader.tsx");
    expect(content).toContain("Zap");
    expect(content).toContain("lucide-react");
  });

  it("WorkoutHeader renders Cached badge text", () => {
    const content = readFile("components/workout/WorkoutHeader.tsx");
    expect(content).toContain("Cached");
  });

  it("WorkoutHeader conditionally renders cached badge", () => {
    const content = readFile("components/workout/WorkoutHeader.tsx");
    expect(content).toContain("{cached &&");
  });
});

// ─── ErrorState BUDGET_EXHAUSTED variant (D-20e) ────────────────────────────

describe("ErrorState — BUDGET_EXHAUSTED variant (D-20e)", () => {
  it("ErrorState has BUDGET_EXHAUSTED in ErrorCode union", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("BUDGET_EXHAUSTED");
  });

  it("ErrorState BUDGET_EXHAUSTED heading contains 'We're popular today'", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("We're popular today");
  });

  it("ErrorState BUDGET_EXHAUSTED body mentions midnight UTC", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("midnight UTC");
  });

  it("ErrorState BUDGET_EXHAUSTED CTA is 'Got it'", () => {
    const content = readFile("components/extract/ErrorState.tsx");
    expect(content).toContain("Got it");
  });
});

// ─── ExtractFlow wiring (D-23 + D-26d) ──────────────────────────────────────

describe("ExtractFlow — passes lowConfidence and cached to WorkoutView", () => {
  it("ExtractFlow passes lowConfidence prop to WorkoutView", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    expect(content).toContain("lowConfidence={state.lowConfidence}");
  });

  it("ExtractFlow passes cached prop to WorkoutView", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    expect(content).toContain("cached={state.cached}");
  });

  it("ExtractFlow dispatches success with lowConfidence from SSE result event", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    expect(content).toContain("lowConfidence: event.lowConfidence");
  });

  it("ExtractFlow dispatches success with cached from SSE result event", () => {
    const content = readFile("components/extract/ExtractFlow.tsx");
    expect(content).toContain("cached: event.cached");
  });
});

// ─── Reducer success state (D-23 + D-26d) ───────────────────────────────────

describe("reducer — success state stores lowConfidence and cached", () => {
  it("reducer success state type includes lowConfidence", () => {
    const content = readFile("components/extract/reducer.ts");
    expect(content).toContain("lowConfidence");
  });

  it("reducer success state type includes cached", () => {
    const content = readFile("components/extract/reducer.ts");
    expect(content).toContain("cached");
  });

  it("reducer success action payload includes lowConfidence", () => {
    const content = readFile("components/extract/reducer.ts");
    expect(content).toContain("lowConfidence?: boolean");
  });

  it("reducer success action payload includes cached", () => {
    const content = readFile("components/extract/reducer.ts");
    expect(content).toContain("cached?: boolean");
  });
});
