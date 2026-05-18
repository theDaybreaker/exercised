/**
 * Eval Runner — tests/eval/run.ts
 *
 * D-21 binary pass criteria gate for Plan 02-06.
 * Runs against a local dev server (pnpm dev) with EXTRACT_MODE=real.
 *
 * Scope reduction (Plan 02-06 deviation, user-approved):
 *   - 3 videos instead of 9 (all fitness YouTube Shorts)
 *   - No non-fitness control in this eval set → D-21c NO_WORKOUT criterion
 *     cannot be exercised; documented as Phase 3 carry-forward
 *   - expectedResult: "either" → pipeline must not crash; schema validates if
 *     a workout is returned; graceful NO_WORKOUT is equally valid for Shorts
 *
 * Run: pnpm eval (requires: pnpm dev running with EXTRACT_MODE=real and
 *       GEMINI_API_KEY or OPENAI_API_KEY set in .env.local)
 *
 * Independent sourceQuote verification (D-21c checker requirement):
 *   For every workout result, re-fetches captions via getCaptions() and
 *   runs validateSourceQuotes(). Does NOT trust the server-side guard alone.
 *
 * Exit codes: 0 = all binary criteria pass, 1 = any binary criterion failed
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { WorkoutSchema } from "@/lib/schema/workout";
import { getCaptions } from "@/lib/youtube/captions";
import { validateSourceQuotes } from "@/lib/guards/sourceQuote";
import type { Workout } from "@/lib/schema/workout";

// ─── Fixture type ────────────────────────────────────────────────────────────

interface EvalFixture {
  slug: string;
  videoId: string;
  videoUrl: string;
  /** "workout" | "no_workout" | "either" */
  expectedResult: "workout" | "no_workout" | "either";
  expectedExerciseCountMin?: number;
  expectedExerciseCountMax?: number;
  minRecallPct?: number;
  notes?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";
const EVAL_DIR = join(dirname(fileURLToPath(import.meta.url)));

// ─── Load fixtures (skip smoke.json — that is for the daily cron) ─────────────

function loadFixtures(): EvalFixture[] {
  const files = readdirSync(EVAL_DIR).filter(
    (f) => f.endsWith(".json") && f !== "smoke.json",
  );

  return files.map((f) => {
    const raw = readFileSync(join(EVAL_DIR, f), "utf-8");
    return JSON.parse(raw) as EvalFixture;
  });
}

// ─── SSE consumer — reads the event stream until done ────────────────────────

interface ExtractResult {
  type: "workout" | "no_workout" | "rate_limited" | "budget_exhausted" | "unknown_error";
  workout?: Workout;
  errorCode?: string;
  errorMessage?: string;
  cached?: boolean;
  lowConfidence?: boolean;
}

async function consumeExtractSSE(url: string): Promise<ExtractResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    return {
      type: "unknown_error",
      errorMessage: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // HTTP-level error responses (rate limit, budget exhausted, etc.)
  if (!response.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    if (response.status === 429 || body.error === "RATE_LIMITED") {
      return { type: "rate_limited", errorCode: "RATE_LIMITED", errorMessage: body.message };
    }
    if (response.status === 503 || body.error === "BUDGET_EXHAUSTED") {
      return { type: "budget_exhausted", errorCode: "BUDGET_EXHAUSTED", errorMessage: body.message };
    }
    return {
      type: "unknown_error",
      errorCode: body.error,
      errorMessage: body.message ?? `HTTP ${response.status}`,
    };
  }

  // SSE stream — read until done
  const reader = response.body?.getReader();
  if (!reader) {
    return { type: "unknown_error", errorMessage: "No response body" };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lastResult: ExtractResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (split on double-newline)
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const dataLine = part
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;

        const jsonStr = dataLine.slice("data: ".length).trim();
        if (!jsonStr) continue;

        let event: { type: string; [key: string]: unknown };
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (event.type === "result") {
          lastResult = {
            type: "workout",
            workout: event.workout as Workout,
            cached: event.cached as boolean | undefined,
            lowConfidence: event.lowConfidence as boolean | undefined,
          };
        } else if (event.type === "error") {
          const code = event.code as string;
          if (code === "NO_WORKOUT") {
            lastResult = { type: "no_workout", errorCode: code, errorMessage: event.message as string };
          } else {
            lastResult = { type: "unknown_error", errorCode: code, errorMessage: event.message as string };
          }
        }
        // stage events: ignore (just progress indicators)
      }
    }
  } finally {
    reader.releaseLock();
  }

  return lastResult ?? { type: "unknown_error", errorMessage: "No result event received" };
}

// ─── Per-video result summary ─────────────────────────────────────────────────

interface VideoResult {
  slug: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string[];
  sourceQuoteVerified?: boolean;
  exerciseCount?: number;
}

const results: VideoResult[] = [];
let totalExercisesVerified = 0;
let totalVideosSourceVerified = 0;

// ─── Test suite ───────────────────────────────────────────────────────────────

const fixtures = loadFixtures();

describe("Eval runner — D-21 binary pass gate (Plan 02-06 scope reduction: 3 Shorts)", () => {
  for (const fixture of fixtures) {
    it(`[${fixture.slug}] binary criteria`, async () => {
      const details: string[] = [];
      const failures: string[] = [];

      // POST to /api/extract and consume SSE stream
      const result = await consumeExtractSSE(fixture.videoUrl);

      // ── Handle rate limit / budget exhausted ──────────────────────────────
      if (result.type === "rate_limited") {
        // Rate limiting hit during eval run — skip this video (not a binary failure)
        details.push("SKIP — rate limited during eval run (reduce rate or wait)");
        results.push({ slug: fixture.slug, status: "SKIP", details });
        return; // vitest skip
      }

      if (result.type === "budget_exhausted") {
        // Budget exhausted — skip (not a binary failure for the eval runner)
        details.push("SKIP — budget exhausted during eval run");
        results.push({ slug: fixture.slug, status: "SKIP", details });
        return;
      }

      // ── expectedResult === "workout" binary checks ────────────────────────
      if (fixture.expectedResult === "workout") {
        if (result.type !== "workout" || !result.workout) {
          failures.push(
            `FAIL — expected workout result but got: ${result.type} (${result.errorCode ?? result.errorMessage ?? "unknown"})`,
          );
        } else {
          // Check 1: WorkoutSchema validates
          const parsed = WorkoutSchema.safeParse(result.workout);
          if (!parsed.success) {
            failures.push(
              `FAIL — WorkoutSchema.parse failed: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
            );
          } else {
            details.push(`WorkoutSchema valid`);
          }

          // Check 2: Exercise count meets minimum recall
          const exerciseCount = result.workout.routine.length;
          if (fixture.expectedExerciseCountMin !== undefined) {
            if (exerciseCount < fixture.expectedExerciseCountMin) {
              failures.push(
                `FAIL — exercise count ${exerciseCount} < expectedMin ${fixture.expectedExerciseCountMin} (≥80% recall)`,
              );
            } else {
              details.push(`${exerciseCount} exercises (≥ min ${fixture.expectedExerciseCountMin})`);
            }
          }
        }
      }

      // ── expectedResult === "no_workout" binary checks ─────────────────────
      if (fixture.expectedResult === "no_workout") {
        if (result.type !== "no_workout") {
          failures.push(
            `FAIL — non-fitness control MUST return NO_WORKOUT but got: ${result.type}`,
          );
        } else {
          details.push("Correctly returned NO_WORKOUT");
        }
      }

      // ── expectedResult === "either" (scope-reduction mode for Shorts) ─────
      if (fixture.expectedResult === "either") {
        if (result.type === "unknown_error" && !result.errorCode) {
          // Network error / crash — binary failure even in "either" mode
          failures.push(`FAIL — pipeline crashed: ${result.errorMessage}`);
        } else if (result.type === "workout" && result.workout) {
          // Workout was returned → schema must validate
          const parsed = WorkoutSchema.safeParse(result.workout);
          if (!parsed.success) {
            failures.push(
              `FAIL — WorkoutSchema.parse failed for returned workout: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
            );
          } else {
            details.push(
              `Workout extracted: ${result.workout.routine.length} exercises, schema valid`,
            );
          }
        } else if (result.type === "no_workout") {
          details.push("Graceful NO_WORKOUT (expected for Shorts with no captions)");
        } else {
          // Other error codes in "either" mode — log but do not fail
          details.push(
            `Result: ${result.type} (${result.errorCode ?? result.errorMessage ?? "—"}) — acceptable in either mode`,
          );
        }
      }

      // ── Independent sourceQuote verification (D-21c) ─────────────────────
      // Re-fetches captions directly and runs validateSourceQuotes.
      // Only runs when a workout was actually returned.
      if (result.type === "workout" && result.workout) {
        const exerciseCount = result.workout.routine.length;

        const transcript = await getCaptions(fixture.videoId);
        if (transcript === null) {
          details.push(
            `WARNING: could not independently verify sourceQuotes for ${fixture.slug} — captions unavailable in eval runner`,
          );
        } else {
          const { droppedCount } = validateSourceQuotes(result.workout, transcript);
          if (droppedCount > 0) {
            // Binary failure — server-side guard is inconsistent with eval runner
            failures.push(
              `FAIL: independent sourceQuote check dropped ${droppedCount} exercises for ${fixture.slug} — server-side guard inconsistent with eval runner re-verification`,
            );
          } else {
            details.push(
              `All sourceQuotes independently verified (${exerciseCount} exercises)`,
            );
            totalExercisesVerified += exerciseCount;
            totalVideosSourceVerified += 1;
          }
        }
      }

      // ── Record result and assert ──────────────────────────────────────────
      const status = failures.length > 0 ? "FAIL" : "PASS";
      const exerciseCount =
        result.type === "workout" && result.workout
          ? result.workout.routine.length
          : undefined;

      results.push({
        slug: fixture.slug,
        status,
        details: [...details, ...failures],
        sourceQuoteVerified: result.type === "workout" && result.workout !== undefined,
        exerciseCount,
      });

      // Vitest assertion — causes exit 1 if any binary criterion failed
      expect(failures, `Binary criteria failures for [${fixture.slug}]:\n${failures.join("\n")}`).toHaveLength(0);
    }, 60_000); // 60s timeout per video (SSE stream can be slow with real AI)
  }

  afterAll(() => {
    // ── Print summary table ───────────────────────────────────────────────
    console.log("\n─────────────────────────────────────────────────────────");
    console.log("EVAL SUMMARY — Plan 02-06 (3 YouTube Shorts, scope reduction)");
    console.log("─────────────────────────────────────────────────────────");

    for (const r of results) {
      const icon = r.status === "PASS" ? "✓" : r.status === "SKIP" ? "~" : "✗";
      console.log(`  ${icon} [${r.status}] ${r.slug}${r.exerciseCount !== undefined ? ` (${r.exerciseCount} exercises)` : ""}`);
      for (const d of r.details) {
        console.log(`      ${d}`);
      }
    }

    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const skipped = results.filter((r) => r.status === "SKIP").length;

    console.log("─────────────────────────────────────────────────────────");
    console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped of ${results.length} total`);

    // Required output per D-21c
    console.log(
      `Independently verified sourceQuotes for ${totalExercisesVerified} exercises across ${totalVideosSourceVerified} videos`,
    );

    if (failed > 0) {
      console.log(
        `\nBINARY CRITERIA FAILED (${failed}/${results.length}). DO NOT proceed to Plan 02-07.`,
      );
    } else if (skipped > 0) {
      console.log(
        `\nAll runnable criteria passed. ${skipped} video(s) skipped (rate limit / budget). Retry after rate-limit window.`,
      );
    } else {
      console.log(`\nAll binary criteria passed (${passed}/${results.length}). Ready for ship gate.`);
    }

    console.log("\nScope-reduction notes:");
    console.log("  - D-21c non-fitness control criterion: NOT COVERED (no non-fitness video in this eval set)");
    console.log("  - D-21b slot coverage: 3/9 (all fitness Shorts — long-form slots deferred)");
    console.log("  - These gaps are documented as Phase 3 carry-forward in 02-06-SUMMARY.md");
    console.log("─────────────────────────────────────────────────────────\n");

    // Explicit exit codes per D-21 spec.
    // Note: vitest already exits with code 1 on test failures; this is an
    // additional explicit signal for the summary-driven case where the human
    // reads console output and wants a clear exit-code guarantee.
    // We use setImmediate to let vitest finish its own teardown first.
    if (failed > 0) {
      setImmediate(() => process.exit(1));
    }
  });
});
