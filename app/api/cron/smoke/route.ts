/**
 * /api/cron/smoke — Daily smoke-test cron handler (D-27)
 *
 * Invoked by Vercel Cron at 09:00 UTC daily (see vercel.json).
 *
 * Protocol:
 * 1. Auth: Authorization: Bearer $CRON_SECRET (T-02-05-01)
 * 2. Read smoke fixture from tests/eval/smoke.json
 * 3. Call /api/extract with the smoke video URL
 * 4. Validate: schema passes + exercise count ±1 of expected
 * 5. On failure: send Resend alert email + open GitHub Issue
 * 6. Always return 200 (do not fail the cron — Vercel retries on 5xx)
 *
 * Security:
 * - CRON_SECRET required in Authorization header (401 on mismatch)
 * - GITHUB_TOKEN / RESEND_API_KEY are optional — alerts degrade gracefully
 *
 * D-27c: Resend email alert
 * D-27d: GitHub Issue on failure
 * OPS-05: Operational smoke test requirement
 */

import { NextRequest } from "next/server";
import { Resend } from "resend";
import { WorkoutSchema } from "@/lib/schema/workout";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Helper: send alert email via Resend ────────────────────────────────────

async function sendSmokeAlert(details: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[smoke-cron] RESEND_API_KEY not set — skipping email alert");
    return;
  }

  const resend = new Resend(apiKey);
  const alertEmail = process.env.ALERT_EMAIL ?? "hello@exercised.app";
  const today = new Date().toISOString().slice(0, 10);

  try {
    await resend.emails.send({
      from: "Exercised Smoke Test <smoke@exercised.app>",
      to: [alertEmail],
      subject: `[Exercised] Daily Smoke Test Failed — ${today}`,
      html: `<p>The daily smoke test for Exercised failed.</p><pre style="font-family:monospace;white-space:pre-wrap">${details}</pre>`,
    });
    console.log(`[smoke-cron] Alert email sent to ${alertEmail}`);
  } catch (err) {
    console.error("[smoke-cron] Failed to send alert email:", err);
  }
}

// ─── Helper: open GitHub Issue on failure ───────────────────────────────────

async function openGitHubIssue(title: string, body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // e.g. "username/exercised"
  if (!token || !repo) {
    console.warn("[smoke-cron] GITHUB_TOKEN or GITHUB_REPO not set — skipping GitHub Issue");
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels: ["smoke-test-failure"] }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[smoke-cron] GitHub Issues API returned ${response.status}: ${text}`);
    } else {
      const issue = await response.json() as { html_url: string };
      console.log(`[smoke-cron] GitHub Issue created: ${issue.html_url}`);
    }
  } catch (err) {
    console.error("[smoke-cron] Failed to open GitHub Issue:", err);
  }
}

// ─── Helper: get base URL for extraction calls ───────────────────────────────

function getBaseUrl(): string {
  // In production (Vercel): VERCEL_URL is auto-injected
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  // In development: localhost
  return "http://localhost:3000";
}

// ─── Main cron handler ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  // T-02-05-01: Auth check — Vercel sends Authorization: Bearer $CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[smoke-cron] Unauthorized request — missing or invalid CRON_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("[smoke-cron] Starting daily smoke test");

  // Load smoke fixture
  // Supports both legacy shape { expectedExerciseCount } and new shape { expectedExerciseCountMin, expectedExerciseCountMax }
  let smokeConfig: {
    videoId: string;
    videoUrl?: string;
    expectedExerciseCount?: number;
    expectedExerciseCountMin?: number;
    expectedExerciseCountMax?: number;
  };
  try {
    // Dynamic import to avoid bundling issues with the file path
    const { default: config } = await import("../../../../tests/eval/smoke.json", {
      assert: { type: "json" },
    });
    smokeConfig = config as typeof smokeConfig;
  } catch (err) {
    const errorMsg = `Failed to load smoke.json: ${err}`;
    console.error(`[smoke-cron] ${errorMsg}`);
    await sendSmokeAlert(`Smoke test setup failed:\n${errorMsg}`);
    await openGitHubIssue(
      `[Smoke] Setup failure — smoke.json missing`,
      `The daily smoke test could not load \`tests/eval/smoke.json\`.\n\nError: ${err}\n\nDate: ${new Date().toISOString()}`
    );
    // Return 200 — Vercel should not retry setup failures
    return new Response("Smoke test setup failed — see logs", { status: 200 });
  }

  // Use videoUrl from fixture if available (Shorts use different URL format); fallback to watch URL
  const smokeUrl = smokeConfig.videoUrl ?? `https://www.youtube.com/watch?v=${smokeConfig.videoId}`;
  const baseUrl = getBaseUrl();

  // Run extraction
  let extractionResult: { workout: unknown; lowConfidence?: boolean } | null = null;
  let extractionError: string | null = null;

  try {
    const res = await fetch(`${baseUrl}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: smokeUrl }),
      signal: AbortSignal.timeout(50_000), // 50s — leave headroom for maxDuration: 60
    });

    if (res.status === 429) {
      extractionError = "Rate limited (429) — smoke test IP hit rate limit";
    } else if (res.status === 503) {
      extractionError = "Budget exhausted (503) — daily spend cap reached";
    } else if (!res.ok) {
      extractionError = `HTTP ${res.status} from /api/extract`;
    } else if (!res.body) {
      extractionError = "No response body from /api/extract";
    } else {
      // Read SSE stream and find the result event
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let foundResult = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;

        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const msg of messages) {
          const dataLine = msg.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as { type: string; [k: string]: unknown };
            if (event.type === "result") {
              extractionResult = event as unknown as { workout: unknown; lowConfidence?: boolean };
              foundResult = true;
              break outer;
            } else if (event.type === "error") {
              const ev = event as unknown as { code: string; message: string };
              extractionError = `Extraction error: ${ev.code} — ${ev.message}`;
              break outer;
            }
          } catch {
            // Malformed SSE — continue
          }
        }
      }

      if (!foundResult && !extractionError) {
        extractionError = "No result event received from /api/extract";
      }
    }
  } catch (err) {
    extractionError = `Network error calling /api/extract: ${err}`;
  }

  // Validate result
  if (extractionError) {
    const details = [
      `videoId: ${smokeConfig.videoId}`,
      `error: ${extractionError}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    console.error(`[smoke-cron] FAILED — ${extractionError}`);
    await sendSmokeAlert(details);
    await openGitHubIssue(
      `[Smoke] Daily smoke test failed — ${new Date().toISOString().slice(0, 10)}`,
      `The daily smoke test failed.\n\n**Video:** https://youtube.com/watch?v=${smokeConfig.videoId}\n\n**Error:**\n\`\`\`\n${extractionError}\n\`\`\`\n\n**Timestamp:** ${new Date().toISOString()}`
    );
    return new Response("Smoke test failed — alerts sent", { status: 200 });
  }

  // Validate WorkoutSchema
  const parsed = WorkoutSchema.safeParse(extractionResult?.workout);
  if (!parsed.success) {
    const validationDetails = [
      `videoId: ${smokeConfig.videoId}`,
      `error: Schema validation failed`,
      `issues: ${JSON.stringify(parsed.error.issues, null, 2)}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    console.error("[smoke-cron] FAILED — schema validation failed");
    await sendSmokeAlert(validationDetails);
    await openGitHubIssue(
      `[Smoke] Schema validation failed — ${new Date().toISOString().slice(0, 10)}`,
      `The daily smoke test failed schema validation.\n\n**Video:** https://youtube.com/watch?v=${smokeConfig.videoId}\n\n**Issues:**\n\`\`\`json\n${JSON.stringify(parsed.error.issues, null, 2)}\n\`\`\`\n\n**Timestamp:** ${new Date().toISOString()}`
    );
    return new Response("Smoke test failed — schema validation error", { status: 200 });
  }

  // Check exercise count against expected range
  // Supports legacy single-value shape (expectedExerciseCount ±1) and new range shape
  const exerciseCount = parsed.data.routine.length;

  // Derive min/max from whichever shape is present
  const expectedMin =
    smokeConfig.expectedExerciseCountMin ??
    (smokeConfig.expectedExerciseCount !== undefined
      ? smokeConfig.expectedExerciseCount - 1
      : 1);
  const expectedMax =
    smokeConfig.expectedExerciseCountMax ??
    (smokeConfig.expectedExerciseCount !== undefined
      ? smokeConfig.expectedExerciseCount + 1
      : 20);

  if (exerciseCount < expectedMin || exerciseCount > expectedMax) {
    const countDetails = [
      `videoId: ${smokeConfig.videoId}`,
      `expected exercises: ${expectedMin}–${expectedMax}`,
      `actual exercises: ${exerciseCount}`,
      `timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    console.error(
      `[smoke-cron] FAILED — exercise count mismatch (expected ${expectedMin}–${expectedMax}, got ${exerciseCount})`
    );
    await sendSmokeAlert(countDetails);
    await openGitHubIssue(
      `[Smoke] Exercise count mismatch — ${new Date().toISOString().slice(0, 10)}`,
      `The daily smoke test produced an unexpected exercise count.\n\n**Video:** https://youtube.com/watch?v=${smokeConfig.videoId}\n\n**Expected:** ${expectedMin}–${expectedMax}\n**Actual:** ${exerciseCount}\n\n**Timestamp:** ${new Date().toISOString()}`
    );
    return new Response("Smoke test failed — exercise count mismatch", { status: 200 });
  }

  // All checks passed
  console.log(
    `[smoke-cron] PASSED — videoId=${smokeConfig.videoId}, exercises=${exerciseCount} (expected ${expectedMin}–${expectedMax}), lowConfidence=${extractionResult?.lowConfidence ?? false}`
  );
  return new Response("OK", { status: 200 });
}
