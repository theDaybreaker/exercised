/**
 * tests/smoke-cron.test.ts
 *
 * Structural and content tests for the daily smoke-test cron handler (D-27, OPS-05).
 * Uses file-content assertions rather than full route handler invocation (which would
 * require live Redis, real API keys, and a running Next.js server).
 *
 * Also tests vercel.json cron configuration and .env.example completeness.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());

function readFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

// ─── Cron route existence and structure ─────────────────────────────────────

describe("smoke cron route — existence and structure (D-27, OPS-05)", () => {
  it("app/api/cron/smoke/route.ts exists", () => {
    expect(() => readFile("app/api/cron/smoke/route.ts")).not.toThrow();
  });

  it("cron route exports runtime='nodejs'", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain('runtime = "nodejs"');
  });

  it("cron route exports maxDuration = 60", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("maxDuration = 60");
  });

  it("cron route exports GET handler", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("export async function GET");
  });

  it("cron route checks CRON_SECRET in Authorization header (T-02-05-01)", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("CRON_SECRET");
    expect(content).toContain("authorization");
  });

  it("cron route returns 401 on auth failure", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("status: 401");
  });

  it("cron route returns 200 on success", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain('"OK"');
    // Returns 200 always (even on failure) so Vercel doesn't retry
    expect(content).toContain("status: 200");
  });

  it("cron route imports Resend from 'resend'", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain('from "resend"');
    expect(content).toContain("Resend");
  });

  it("cron route uses RESEND_API_KEY env var (D-27c)", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("RESEND_API_KEY");
  });

  it("cron route falls back to console.error when RESEND_API_KEY missing", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("console.error");
    expect(content).toContain("RESEND_API_KEY not set");
  });

  it("cron route calls GitHub Issues REST API (D-27d)", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("api.github.com/repos/");
  });

  it("cron route uses GITHUB_TOKEN env var (T-02-05-02)", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("GITHUB_TOKEN");
  });

  it("cron route skips GitHub Issue gracefully when GITHUB_TOKEN missing", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("GITHUB_TOKEN or GITHUB_REPO not set");
  });

  it("cron route validates WorkoutSchema on extraction result", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    expect(content).toContain("WorkoutSchema");
    expect(content).toContain("safeParse");
  });

  it("cron route checks exercise count within expected range", () => {
    const content = readFile("app/api/cron/smoke/route.ts");
    // Plan 02-06 refactored cron handler to support min/max range alongside legacy single-value ±1.
    expect(content).toContain("expectedExerciseCount");
    expect(content).toMatch(/expectedMin|expectedExerciseCountMin/);
    expect(content).toMatch(/expectedMax|expectedExerciseCountMax/);
  });
});

// ─── smoke.json fixture ─────────────────────────────────────────────────────

describe("smoke.json fixture (D-27b)", () => {
  it("tests/eval/smoke.json exists", () => {
    expect(() => readFile("tests/eval/smoke.json")).not.toThrow();
  });

  it("smoke.json has videoId field", () => {
    const content = readFile("tests/eval/smoke.json");
    const json = JSON.parse(content) as Record<string, unknown>;
    expect(json).toHaveProperty("videoId");
    expect(typeof json.videoId).toBe("string");
  });

  it("smoke.json has an expected exercise count (singular or min/max range)", () => {
    // Plan 02-06 refactored to a min/max range; the cron handler supports either shape.
    const content = readFile("tests/eval/smoke.json");
    const json = JSON.parse(content) as Record<string, unknown>;
    const hasSingular =
      typeof json.expectedExerciseCount === "number";
    const hasRange =
      typeof json.expectedExerciseCountMin === "number" &&
      typeof json.expectedExerciseCountMax === "number";
    expect(hasSingular || hasRange).toBe(true);
  });
});

// ─── vercel.json cron configuration ─────────────────────────────────────────

describe("vercel.json — cron configuration (D-27a)", () => {
  it("vercel.json exists", () => {
    expect(() => readFile("vercel.json")).not.toThrow();
  });

  it("vercel.json has crons array", () => {
    const content = readFile("vercel.json");
    const json = JSON.parse(content) as { crons?: unknown[] };
    expect(json).toHaveProperty("crons");
    expect(Array.isArray(json.crons)).toBe(true);
  });

  it("vercel.json crons has /api/cron/smoke path", () => {
    const content = readFile("vercel.json");
    expect(content).toContain('"/api/cron/smoke"');
  });

  it("vercel.json crons has 09:00 UTC daily schedule (D-27a)", () => {
    const content = readFile("vercel.json");
    expect(content).toContain('"0 9 * * *"');
  });
});

// ─── /about page ─────────────────────────────────────────────────────────────

describe("/about page — three D-24 sections", () => {
  it("app/about/page.tsx exists", () => {
    expect(() => readFile("app/about/page.tsx")).not.toThrow();
  });

  it("/about page is an RSC (no 'use client' directive at top of file)", () => {
    const content = readFile("app/about/page.tsx");
    // Check that the file does not START with "use client" — a comment mentioning it is fine
    // RSC pages should not have the directive as the first non-comment statement
    const lines = content.split("\n");
    const firstCodeLine = lines.find(
      (l) => l.trim() !== "" && !l.trim().startsWith("/*") && !l.trim().startsWith("*") && !l.trim().startsWith("//")
    );
    expect(firstCodeLine).not.toContain('"use client"');
  });

  it("/about page has metadata export", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("export const metadata");
  });

  it("/about page contains D-24c text: 'Exercised extracts workout routines'", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("Exercised extracts workout routines");
  });

  it("/about page contains 'What this is' section heading", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("What this is");
  });

  it("/about page contains 'AI accuracy' section heading", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("AI accuracy");
  });

  it("/about page contains 'DMCA / takedowns' section heading", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("DMCA / takedowns");
  });

  it("/about page contains contact email (from ALERT_EMAIL or fallback)", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("hello@exercised.app");
  });

  it("/about page uses ALERT_EMAIL env var with fallback", () => {
    const content = readFile("app/about/page.tsx");
    expect(content).toContain("ALERT_EMAIL");
  });
});

// ─── Footer /about link ───────────────────────────────────────────────────────

describe("Footer — Terms & DMCA link to /about (D-24a)", () => {
  it("Footer contains href='/about'", () => {
    const content = readFile("components/layout/Footer.tsx");
    expect(content).toContain('href="/about"');
  });

  it("Footer contains 'Terms & DMCA' link text", () => {
    const content = readFile("components/layout/Footer.tsx");
    // May be encoded as &amp; in JSX or literal &
    const hasTerms = content.includes("Terms") && content.includes("DMCA");
    expect(hasTerms).toBe(true);
  });

  it("Footer imports Link from next/link for /about link", () => {
    const content = readFile("components/layout/Footer.tsx");
    expect(content).toContain("next/link");
  });
});

// ─── .env.example completeness ─────────────────────────────────────────────

describe(".env.example — new env vars present", () => {
  it("RESEND_API_KEY is in .env.example", () => {
    const content = readFile(".env.example");
    expect(content).toContain("RESEND_API_KEY");
  });

  it("ALERT_EMAIL is in .env.example", () => {
    const content = readFile(".env.example");
    expect(content).toContain("ALERT_EMAIL");
  });

  it("CRON_SECRET is in .env.example", () => {
    const content = readFile(".env.example");
    expect(content).toContain("CRON_SECRET");
  });

  it("GITHUB_TOKEN is in .env.example", () => {
    const content = readFile(".env.example");
    expect(content).toContain("GITHUB_TOKEN");
  });

  it("GITHUB_REPO is in .env.example", () => {
    const content = readFile(".env.example");
    expect(content).toContain("GITHUB_REPO");
  });
});
