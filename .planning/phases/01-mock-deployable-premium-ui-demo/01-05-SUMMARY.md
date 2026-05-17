---
phase: 01-mock-deployable-premium-ui-demo
plan: 05
subsystem: polish
tags: [reduced-motion, accessibility, mobile, sticky-actionbar, tooltip, wcag, a11y, safe-area, touch-targets]
dependency_graph:
  requires:
    - 01-04
  provides:
    - DSGN-05 (per-moment reduced-motion compliance across all 7 UI-SPEC §6.5 moments)
    - DSGN-06 (axe-core WCAG audit — pending production deploy)
    - OUTV-07 (full mobile audit: sticky ActionBar, safe-area, 44px touch targets)
  affects:
    - app/globals.css
    - components/workout/ActionBar.tsx
    - components/workout/WorkoutView.tsx
tech_stack:
  added: []
  patterns:
    - prefers-reduced-motion CSS media block (7 moments exhaustively enumerated)
    - base-ui Tooltip.Trigger with className styling (no asChild — base-ui API)
    - Tailwind responsive classes for mobile/desktop ActionBar layout switch
    - env(safe-area-inset-bottom) for notched device support
key_files:
  modified:
    - app/globals.css
    - components/workout/ActionBar.tsx
    - components/workout/WorkoutView.tsx
decisions:
  - "base-ui Tooltip.Trigger does not support asChild — styled via className prop instead; TooltipTrigger renders as <button> natively, which is correct"
  - "Mobile glass perf fallback is a heuristic: prefers-reduced-motion + max-width:480px; real mid-range Android validation deferred per CONTEXT.md"
  - "axe-core production audit deferred: no git remote configured, no Vercel URL live; must complete OPS-02 setup first"
metrics:
  completed_date: "2026-05-17"
  task_count: 2 completed (Tasks 1 and 2), 1 pending (Task 3a), 1 checkpoint (Task 3b), 1 pending (Task 3c)
---

# Phase 1 Plan 5: Polish — Reduced Motion, Mobile ActionBar, Tooltips, WCAG Audit

**One-liner:** Per-moment reduced-motion compliance across all 7 UI-SPEC §6.5 motion moments + mobile sticky-bottom ActionBar with safe-area padding + tooltip disambiguation on Copy buttons.

## Tasks Executed

### Task 1: Per-moment reduced-motion compliance — all 7 UI-SPEC §6.5 motion moments

**Status:** Complete — committed `8748584`

**Audit results by moment:**

| # | Moment | Gating Mechanism | Status |
|---|--------|-----------------|--------|
| 1 | Gradient orb drift | CSS `@media (prefers-reduced-motion: reduce)` — `.orb-1/2/3 { animation: none !important }` | Pre-existing; audit confirmed correct |
| 2 | Pulse-dot scale | CSS `@media` block — `.pulse-dot { animation: none !important }` + CSS class `pulse-dot` in LoadingStages.tsx | Pre-existing; audit confirmed correct |
| 3 | Skeleton shimmer | CSS `@media` block — `.skeleton-shimmer { animation: none !important }` + class `skeleton-shimmer` in SkeletonCard.tsx | Pre-existing; audit confirmed correct |
| 4 | Result-cascade stagger | Motion `useReducedMotion()` in WorkoutView.tsx — `shouldAnimate = shouldAnimateIn && !prefersReducedMotion` | Pre-existing; audit confirmed correct |
| 5 | Card hover-lift | CSS `@media` block — `.card-hover-lift, .glass-card:hover { transition: none !important; transform: none !important }` + NEW: `(hover: hover) and (pointer: fine)` guard on `:hover` rule | Enhanced in this plan |
| 6 | Form-cue expansion | Motion `useReducedMotion()` in ExerciseCard.tsx + SupersetCard.tsx — `transition: { duration: 0 }` when reduced | Pre-existing; audit confirmed correct |
| 7 | Toast entrance | Sonner default respects prefers-reduced-motion + CSS belt-and-suspenders: `[data-sonner-toast] { animation: none !important; transition: opacity 100ms ease !important }` | NEW in this plan |

**New CSS additions in `app/globals.css`:**
- Reduced Motion Audit comment block at top of file listing all 7 moments with gating mechanism
- `@media (hover: hover) and (pointer: fine)` guard around `.glass-card:hover` with full hover-lift effect (translateY(-2px) + glow box-shadow + accent border-color)
- `.card-hover-lift, .glass-card:hover` in reduced-motion block with `transition: none !important; transform: none !important`
- `[data-sonner-toast]` in reduced-motion block with fade-only transition override
- Mobile glass perf fallback: `@media (prefers-reduced-motion: reduce) and (max-width: 480px)` — sets `backdrop-filter: none` on `.glass-card` (heuristic; real-device validation deferred)

### Task 2: Mobile sticky-bottom ActionBar + tooltip disambiguation + 44px touch targets

**Status:** Complete — committed `0709330`

**ActionBar changes:**
- Mobile (`<md`): `fixed bottom-0 left-0 right-0 z-30` glass bar with `pb-[env(safe-area-inset-bottom)]` for notched devices
- Desktop (`≥md`): `md:relative md:bottom-auto ... md:bg-transparent md:backdrop-blur-none md:border-0 md:justify-end`
- Short labels on mobile (`Watch` / `Copy MD` / `Copy` / `Share`), full labels on desktop (`Watch on YouTube` / `Copy as Markdown` / `Copy as Plain Text` / `Share Workout`)
- `TooltipProvider` wraps all 4 buttons; Copy buttons wrapped in `Tooltip` / `TooltipTrigger` / `TooltipContent`
- `TooltipContent` uses `hidden md:inline-flex` to suppress tooltips on mobile (no hover event possible)
- Tooltip text: "Copy a markdown representation of this workout" / "Copy a plain-text version (no markdown syntax) for Notes / WhatsApp"

**API deviation (auto-fix, Rule 1):** `@base-ui/react` Tooltip.Trigger uses `render` prop pattern instead of Radix-style `asChild`. Since Trigger already renders as `<button>`, we applied button styling via `className` prop directly on `TooltipTrigger` rather than trying to compose with the shadcn `<Button>` component. This is semantically correct — one button element vs nested buttons.

**WorkoutView changes:**
- `pb-24 md:pb-16` on `<motion.article>` — prevents exercise list content from being clipped by the mobile sticky bar

**Touch-target audit:**

| Element | Height | Status |
|---------|--------|--------|
| Extract Workout CTA | `h-14` (56px) | Pass |
| ActionBar Watch / Copy MD / Copy Plain / Share | `h-11` (44px) | Pass |
| Form-cue expand toggle (ExerciseCard) | `min-h-[44px]` | Pass (pre-existing) |
| ErrorState recovery button | `h-11 size="lg"` | Pass (pre-existing) |

### Task 3a: Deploy + axe-core WCAG audit

**Status:** BLOCKED — no git remote configured, no production URL available

The project has no GitHub remote set up. The Vercel auto-deploy has not been triggered. To unblock:
1. Create a GitHub repository
2. `git remote add origin <github-url> && git push -u origin main`
3. Connect the repo to Vercel
4. Record the production URL as `$PROD_URL`
5. Run `pnpm dlx @axe-core/cli "$PROD_URL" --tags wcag2a,wcag2aa`

Local axe-core execution was attempted but failed: `@axe-core/cli` requires ChromeDriver which was not available in the environment (`chromedriver` binary missing from `node_modules`).

### Task 3b: Human cross-device share-link smoke test

**Status:** CHECKPOINT — awaiting production deploy from 3a

### Task 3c: Finalize STATE.md + ROADMAP.md

**Status:** PENDING — after 3b passes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - API Difference] base-ui Tooltip.Trigger has no `asChild` prop**
- **Found during:** Task 2 — TypeScript error TS2322 on `asChild`
- **Issue:** The plan specified `<TooltipTrigger asChild>` assuming Radix-style tooltip API. The installed `@base-ui/react` Tooltip.Trigger does not support `asChild` — it uses a `render` prop pattern.
- **Fix:** Removed `asChild` and applied button styling directly via `className` on `TooltipTrigger`. Since the Trigger already renders as a semantic `<button>` element, this is the correct approach — no nested button elements.
- **Files modified:** `components/workout/ActionBar.tsx`
- **Commit:** `0709330`

### Deferred Items

1. **Production deploy + axe-core audit (DSGN-06):** Blocked on OPS-02 (GitHub remote + Vercel setup). Must be completed as part of the Phase 1 exit gate.
2. **Cross-device share-link smoke test (Task 3b):** Blocked on production deploy.
3. **STATE.md / ROADMAP.md Phase 1 finalization (Task 3c):** Blocked on Task 3b passing.
4. **Real-device mid-range Android glass-perf validation:** Deferred to Phase 4 / future perf pass per CONTEXT.md `<deferred>`.
5. **SSR pre-decode for `?w=` to avoid input-flash:** Deferred per RESEARCH §"Pitfall 2".
6. **useTransition for SSE dispatch on low-end devices:** Deferred per RESEARCH §"Open Question 5".

## Phase 2 Hand-off Note

The swap point for real extraction is `lib/extraction/real.ts` (Plan 01-02 stub with explicit throw). The env var is `EXTRACT_MODE=real`. The frontend requires zero changes; the Zod `Workout` schema in `lib/schema/workout.ts` is the shared contract.

**CRITICAL:** The full cost-protection stack (Upstash rate limit, daily cap, OpenAI + Vercel budget caps, DMCA page, daily smoke test) MUST ship in the same release as the first real OpenAI key per Phase 2 ROADMAP scope — non-negotiable.

## Self-Check

Files created/modified:
- [x] `app/globals.css` — modified with reduced-motion enhancements
- [x] `components/workout/ActionBar.tsx` — rewritten with mobile sticky + tooltips
- [x] `components/workout/WorkoutView.tsx` — pb-24 md:pb-16 added

Commits:
- [x] `8748584` — Task 1 reduced-motion
- [x] `0709330` — Task 2 mobile ActionBar + tooltips

## Self-Check: PARTIAL PASS

Tasks 1 and 2 complete. Tasks 3a, 3b, 3c pending production deploy and human verification.
