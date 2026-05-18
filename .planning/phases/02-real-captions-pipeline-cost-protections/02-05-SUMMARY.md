---
phase: "02"
plan: "05"
subsystem: "ui/ops"
tags:
  - confidence-banner
  - error-state
  - cached-badge
  - about-page
  - smoke-cron
  - vercel-cron
  - resend
dependency_graph:
  requires:
    - 02-04  # SSE result event has lowConfidence + cached fields
  provides:
    - ERRS-04  # ConfidenceBanner for low-confidence extractions
    - OPS-04   # /about DMCA page with contact email
    - OPS-05   # Daily smoke-test cron handler
  affects:
    - components/workout/WorkoutView.tsx
    - components/workout/WorkoutHeader.tsx
    - components/extract/ExtractFlow.tsx
    - components/extract/ErrorState.tsx
tech_stack:
  added:
    - resend (already installed, now used in smoke cron handler)
    - next/link (Footer, /about back-link)
    - lucide-react Zap (cached badge icon)
  patterns:
    - Vercel Cron at 09:00 UTC via vercel.json crons entry
    - Resend email alert with graceful fallback to console.error
    - GitHub Issues REST API for durable smoke failure tracking
    - RSC /about page with ALERT_EMAIL env-driven contact
    - Amber role="status" dismissible banner (not role="alert")
key_files:
  created:
    - components/extract/ConfidenceBanner.tsx
    - app/about/page.tsx
    - app/api/cron/smoke/route.ts
    - tests/eval/smoke.json
    - tests/confidence-banner.test.ts
    - tests/smoke-cron.test.ts
  modified:
    - components/workout/WorkoutView.tsx
    - components/workout/WorkoutHeader.tsx
    - components/extract/ExtractFlow.tsx
    - components/layout/Footer.tsx
    - vercel.json
decisions:
  - key: amber-via-inline-styles
    choice: Used inline style with RGB amber values (245, 158, 11) rather than Tailwind amber-* classes
    reason: The project uses CSS variables + glassmorphism inline styles throughout; amber-* Tailwind classes would be inconsistent with existing component style patterns
  - key: smoke-cron-always-200
    choice: Smoke cron handler always returns HTTP 200 even on extraction failure
    reason: Vercel Cron retries on 5xx responses. Extraction failures are reported via email/GitHub Issue — a 500 response would cause redundant retries without benefit. Returning 200 with a descriptive body is the correct Vercel Cron pattern.
  - key: smoke-json-placeholder
    choice: Created tests/eval/smoke.json with dQw4w9WgXcQ placeholder videoId
    reason: Plan 02-06 will replace this with a real known-good fitness video. The placeholder lets the cron handler wire up correctly without requiring a real video now.
  - key: cached-badge-in-header
    choice: Cached badge rendered inline in WorkoutHeader (not ActionBar)
    reason: WorkoutHeader already contains all metadata chips (duration, difficulty, muscles). The cached badge is metadata about the result — not an action — so the header is the semantically correct location.
  - key: about-page-uses-alert-email-env
    choice: ALERT_EMAIL env var drives the DMCA contact email in /about page
    reason: Consistent with the smoke cron handler — single env var for alert email. Avoids hardcoding hello@exercised.app in two places. Default fallback matches the smoke cron default.
metrics:
  duration_minutes: 8
  completed_date: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 5
---

# Phase 02 Plan 05: UI/Ops Surfaces Summary

**One-liner:** Amber ConfidenceBanner, cached badge, BUDGET_EXHAUSTED ErrorState, /about DMCA page, and daily smoke cron with Resend email + GitHub Issue alerting.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | ConfidenceBanner + cached badge + ErrorState wiring | 76aad89 | Complete |
| 2 | /about page + footer DMCA link + smoke cron + vercel.json | bc2b171 | Complete |
| 3 | Human verify — /about page content + ALERT_EMAIL blocker | — | **Approved by user** |

## What Was Built

### Task 1: ConfidenceBanner + BUDGET_EXHAUSTED + Cached Badge

**`components/extract/ConfidenceBanner.tsx`** (new):
- Amber dismissible banner with `role="status"` (informational, not alert)
- D-23e copy: "Heads up — this extraction may be incomplete. Skim the source video for anything we missed."
- X button calls `onDismiss` prop; styled with amber RGB values (not Tailwind classes, consistent with glassmorphism patterns)
- Not red — amber is visually distinct from ErrorState's error treatment

**`components/workout/WorkoutView.tsx`** (updated):
- Added `lowConfidence?: boolean` and `cached?: boolean` props
- Added `useState` for `bannerDismissed` — dismissal is local, not persisted
- Renders `<ConfidenceBanner>` above WorkoutHeader when `lowConfidence && !bannerDismissed`
- Passes `cached` prop to `<WorkoutHeader>`

**`components/workout/WorkoutHeader.tsx`** (updated):
- Added `cached?: boolean` prop
- Renders a small `⚡ Cached` chip (Zap icon + "Cached" text) when `cached=true`
- Uses accent color with 15% opacity background — subtle, informational, not loud

**`components/extract/ExtractFlow.tsx`** (updated):
- Now passes `lowConfidence={state.lowConfidence}` and `cached={state.cached}` to `<WorkoutView>`
- These come from the reducer success state (wired in Plan 02-04)

**`components/extract/ErrorState.tsx`** — confirmed `BUDGET_EXHAUSTED` variant was already present from prior plan (heading: "We're popular today.", body mentions "midnight UTC", CTA: "Got it"). No change needed.

### Task 2: /about Page + Footer + Smoke Cron

**`app/about/page.tsx`** (new RSC):
- Three D-24 sections: "What this is", "AI accuracy", "DMCA / takedowns"
- Glassmorphism `glass-card` containers consistent with the rest of the app
- `contactEmail = process.env.ALERT_EMAIL ?? "hello@exercised.app"` — env-driven DMCA contact
- Metadata export: `title: "About Exercised"`

**`components/layout/Footer.tsx`** (updated):
- Added "Terms & DMCA" link using `next/link` to `/about`
- Positioned inline next to the AI-disclaimer text per D-24a
- Underline styling, `hover:opacity-80` transition

**`app/api/cron/smoke/route.ts`** (new):
- `runtime = "nodejs"`, `maxDuration = 60`
- Auth: `Authorization: Bearer $CRON_SECRET` → 401 on mismatch
- Loads `tests/eval/smoke.json` for videoId + expectedExerciseCount
- Calls `/api/extract` SSE stream, finds `result` event
- Validates against `WorkoutSchema.safeParse()` + exercise count ±1
- On failure: `sendSmokeAlert()` via Resend (degrades to `console.error` if `RESEND_API_KEY` missing) + `openGitHubIssue()` (skipped if `GITHUB_TOKEN`/`GITHUB_REPO` missing)
- Always returns 200 so Vercel does not retry

**`vercel.json`** (updated):
- Added `"crons": [{ "path": "/api/cron/smoke", "schedule": "0 9 * * *" }]` per D-27a

**`tests/eval/smoke.json`** (new placeholder):
- `{ "videoId": "dQw4w9WgXcQ", "expectedExerciseCount": 5 }` — Plan 02-06 replaces with a real fitness video

## Deviations from Plan

### Auto-fixed Issues

None — the plan was executed exactly as written with one minor clarification:

**1. [Rule 1 - Bug] BUDGET_EXHAUSTED ErrorState already existed**
- The plan spec said "add 5th variant" — when reading ErrorState.tsx, the variant was already present from Plan 02-04 implementation
- Verified the copy matches D-20e ("We're popular today." heading + "midnight UTC" in body)
- No change made, noted as confirmed-existing

**2. [Rule 2 - Missing critical] Test assertions updated for comment-in-source edge cases**
- `confidence-banner.test.ts`: test for "amber" in file content updated to check amber RGB values (245, 158, 11) since the component uses inline styles, not Tailwind amber-* classes
- `smoke-cron.test.ts`: RSC check updated to scan for `"use client"` as a code directive (not in comments)

## Known Stubs

**`tests/eval/smoke.json`** — Placeholder videoId `dQw4w9WgXcQ` (Rick Astley — not a fitness video). The smoke cron will fail the `expectedExerciseCount: 5` check if it runs against this fixture. Plan 02-06 replaces this with a real known-good fitness video. The smoke cron infra is fully wired; only the fixture needs updating.

## Human Verify — Task 3 Results

**Status:** Approved by user (2026-05-18)

**Checks passed:**
1. Main page renders correctly with no console errors
2. Footer "Terms & DMCA" link navigates to /about
3. /about page renders with all 3 sections (What this is / AI accuracy / DMCA contact)

**ALERT_EMAIL blocker (D-24d):** RESOLVED for development — ALERT_EMAIL is set in .env.local (pulled from Vercel Preview environment). Production env vars to be confirmed in Plan 02-07.

## Deferred Credentials (Carry Forward to Plan 02-07)

The following env vars are not yet set. Smoke-test alerting degrades gracefully without them (console.error fallback). These must be configured before the Phase 2 production ship gate:

| Env Var | Purpose | Status | Source |
|---------|---------|--------|--------|
| `RESEND_API_KEY` | Smoke failure email alerts (D-27c) | Pending | https://resend.com/api-keys |
| `GITHUB_TOKEN` | Auto-open GitHub Issue on smoke failure (D-27d) | Pending | GitHub → Settings → Developer settings → PAT with repo scope |
| `GITHUB_REPO` | Target repo for auto-issues | Pending | Set to `username/exercised` |
| `CRON_SECRET` | Vercel Cron auth — smoke cron returns 401 without this | Pending | `openssl rand -hex 32` — set in Vercel Environment Variables |

**Note:** `CRON_SECRET` is auto-injected by Vercel when the cron is configured in the dashboard, but must be explicitly set in environment variables to match. Plan 02-07 owner-action checklist must verify all four are set before EXTRACT_MODE=real flip.

## Blockers / Concerns (Historical)

**ALERT_EMAIL launch blocker (D-24d):** RESOLVED — ALERT_EMAIL is set in .env.local. Production confirmation in Plan 02-07.

**CRON_SECRET not yet set:** The smoke cron returns 401 for all requests until `CRON_SECRET` is configured in Vercel environment variables. Deferred to Plan 02-07 owner-action checklist.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. All mitigations are implemented:
- T-02-05-01 (CRON_SECRET auth): Implemented — 401 on mismatch
- T-02-05-02 (GITHUB_TOKEN not serialized): GITHUB_TOKEN accessed via `process.env` only, never in response body

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `components/extract/ConfidenceBanner.tsx` | FOUND |
| `app/about/page.tsx` | FOUND |
| `app/api/cron/smoke/route.ts` | FOUND |
| `tests/eval/smoke.json` | FOUND |
| Commit `76aad89` (Task 1) | FOUND |
| Commit `bc2b171` (Task 2) | FOUND |
| Task 3 human verification | APPROVED |

**Plan complete** — all 3 tasks executed, human checkpoint approved, deferred credentials documented for Plan 02-07.
