# Phase 1: Mock-Deployable Premium UI Demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 1-Mock-Deployable Premium UI Demo
**Areas discussed:** Visual Identity, Loading Choreography, Mock Fixture Strategy, Routing & Share Semantics

---

## Visual Identity

### Accent color

| Option | Description | Selected |
|--------|-------------|----------|
| Neon green (#39FF14 family) | Energetic, 'high-performance fitness' vibe. Slightly riskier on text contrast — needs care on WCAG. Strong association: Whoop, athletic apparel. | ✓ |
| Electric blue (#0EA5E9 / cyan family) | Cooler, premium-tech feel. Easier on contrast against dark glassmorphism. Strong association: Vercel, modern AI products. | |
| Both, with neon green primary | Green as the dominant accent, electric blue as a secondary highlight. More design work upfront but more visual range. | |
| You decide | Pick what fits the dark glassmorphism aesthetic best — lock it and don't relitigate. | |

**User's choice:** Neon green (#39FF14 family)
**Notes:** Locked as the single accent — CTAs, focus rings, active stage indicators, hover glow. Exact hex tuned during build for WCAG 4.5:1 against glassmorphic surfaces.

### Typography

| Option | Description | Selected |
|--------|-------------|----------|
| Geist (single family, Recommended) | Vercel's font. Body + display from one family. Premium feel, zero pairing risk, smallest CSS payload, built into next/font. | ✓ |
| Inter + Outfit (paired) | Inter for body, Outfit for display/numbers. More expressive but more design work. | |
| Outfit only | Single family from brief. Display-forward. Risk: less proven for long body copy on mobile. | |
| Inter only | Single family from brief. Safest, most neutral — may feel less 'premium fitness'. | |

**User's choice:** Geist
**Notes:** Diverges from brief's "Inter or Outfit" — research recommended Geist for DX and same directional feel.

### Glassmorphism intensity

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle premium (Recommended) | Ambient gradient bg with 2-3 vibrant orbs, cards at 10-12% white opacity + backdrop-blur 16px + 1px white@10% border. Restrained — the bg does the work. | ✓ |
| Aggressive glass | Stronger blur (24-32px), more vibrant orbs, cards at 15-20% opacity. iOS-Vision-Pro feel. Higher mobile perf cost. | |
| Minimalist (less glass) | Mostly flat dark with glass reserved for hero CTA and active states only. Cheapest performance, leans Linear/Notion. | |

**User's choice:** Subtle premium
**Notes:** Directly addresses research's Pitfall #6 (glassmorphism done badly = 2014 Dribbble).

### Hero layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single-screen, centered hero (Recommended) | Headline + URL input + CTA centered. Minimal copy. Ambient orbs do visual lifting. Tool-feel — paste and go. | ✓ |
| Hero + 'How it works' scroll section | Centered hero + scrolled 3-step explainer. More marketing-y; better for cold visitors. | |
| Hero + sample workouts preview | Centered hero + scroll-revealed strip of example workouts. Demonstrates value before paste. | |

**User's choice:** Single-screen, centered hero
**Notes:** No scroll-revealed sections in v1. Ambient orbs carry visual interest before paste.

---

## Loading Choreography

### Stage copy

| Option | Description | Selected |
|--------|-------------|----------|
| Brief copy (Recommended) | 'Fetching video data…' → 'Transcribing audio…' → 'Analyzing form cues…' → 'Generating routine…' — sentence-cased with ellipses | ✓ |
| Terse one-word | 'Fetching' → 'Transcribing' → 'Analyzing' → 'Generating' — minimal, Linear/Notion vibe | |
| Witty/branded copy | 'Hunting the video…' → 'Reading the cues…' → 'Counting your reps…' → 'Racking your routine…' — more personality, riskier on tone | |

**User's choice:** Brief copy
**Notes:** Honors the brief's exact wording. Ships as-is.

### Mock pipeline duration

| Option | Description | Selected |
|--------|-------------|----------|
| ~3s total (per brief) | 750ms per stage × 4. Each label just barely readable. Snappy. | |
| ~4-5s total | ~1.1s per stage. Each label visible, less rushed. Sets a non-rushed expectation for real backend. | ✓ |
| Variable per stage | Different dwell per stage to mimic realistic backend timing. | |

**User's choice:** ~4-5s total
**Notes:** Diverges from brief's 3s. Gives each stage time to register.

### Result reveal

| Option | Description | Selected |
|--------|-------------|----------|
| All at once with fade-in (Recommended) | Loading → dissolve → full workout fades in with stagger cascade. Backend emits one 'result' event with full Workout. | ✓ |
| Progressive streaming | Each exercise card streams in as the LLM generates it. More 'AI-magic' but every component must handle partial state. | |
| Loading collapses into workout | Stage indicator transforms into workout header in-place. Premium but Motion-heavy. | |

**User's choice:** All at once with fade-in
**Notes:** Simplest contract. Backend emits single `result` event with full Workout. No partial-state handling needed in components.

### Stage UI

| Option | Description | Selected |
|--------|-------------|----------|
| Active stage + skeleton cards (Recommended) | Single active stage label with pulse, previous-stage checkmarks beside it, 3-4 skeleton cards below. | ✓ |
| Vertical progress list | All 4 stages listed vertically; previous = check, active = spinner, future = dim. | |
| Single stage, no skeleton | Just current stage with accent underline animation. Skeleton appears only at 'generating' stage. | |

**User's choice:** Active stage + skeleton cards
**Notes:** Anchors user to what's coming. Skeleton visible from the start.

---

## Mock Fixture Strategy

### Fixture count and variety

| Option | Description | Selected |
|--------|-------------|----------|
| 5-6 varied fixtures (Recommended) | Brief's leg day + bodyweight push (no superset) + full-body with 2 supersets + short warmup + long hypertrophy + error/empty triggers. Exercises every UI state. | ✓ |
| Just the brief fixture | One fixture only. Simplest, but doesn't prove supersets, long lists, or empty states render correctly. | |
| 3 fixtures + states | Brief + one no-superset + one long-list. Plus error / no-workout triggers. Middle ground. | |

**User's choice:** 5-6 varied fixtures
**Notes:** Exercises every UI state. Will inform real fixture quality once Phase 2 ships.

### URL → fixture mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Hash of URL → deterministic pick (Recommended) | Hash videoId, mod by fixture count. Same URL = same fixture. Variety across pastes, share-link consistency. | ✓ |
| Special demo URLs trigger specific fixtures | URL keywords like 'demo-legs' trigger specific fixtures. Easier to demo specific states. | |
| Random rotation | Random per request. Maximum variety but breaks share-link UX. | |
| Both: hash + special demo keywords | Hash for normal URLs + keywords for demo. Best for demoing and consistency. | |

**User's choice:** Hash of URL → deterministic pick
**Notes:** Preserves share-link consistency. Error/empty states handled separately via URL keywords (next question).

### Error/empty state triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Special URL keywords (Recommended) | URLs containing 'fail', 'empty', 'rate-limit' trigger respective states. Easy to demo. Doesn't break hash-based normal flow. | ✓ |
| Dedicated /preview route | /preview page lists all UI states for design review. Pure dev affordance. | |
| Both | URL keywords for in-flow demoing + /preview route for review. Slightly more work, better DX. | |

**User's choice:** Special URL keywords
**Notes:** `/preview` route deferred — could be added later if design review becomes recurring.

### Fixture storage

| Option | Description | Selected |
|--------|-------------|----------|
| tests/fixtures/*.json + parsed via Zod at boot (Recommended) | Plain JSON files, validated by WorkoutSchema at startup. Schema drift fails fast. | ✓ |
| Inline TS const arrays | Hardcoded as TypeScript constants. Type-checked at compile time but harder for designers to edit. | |
| tests/fixtures/*.json + lazy load | JSON files loaded on demand. Memory-cheaper but no boot-time validation. | |

**User's choice:** tests/fixtures/*.json + parsed via Zod at boot
**Notes:** Contract enforcement at the schema boundary. Fixtures stay valid as schema evolves.

---

## Routing & Share Semantics

### Routing architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page state machine (Recommended) | One route `/` with useReducer swapping idle → loading → success. Simplest mental model. Refresh on workout re-extracts unless URL params. | ✓ |
| Route-based (`/` → `/w/[hash]`) | Landing on `/`, output at `/w/[lz-string-hash]`. Browser back returns to landing. Slightly more complex but better UX. | |
| Single-page + query param hydration | One route, but `?w=hash` hydrates on load. Hybrid. | |

**User's choice:** Single-page state machine
**Notes:** Picked the simplest mental model. Share-URL behavior clarified in next question (effectively becomes the hybrid).

### Share URL behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Query param hydration (Recommended) | `?w=lz-string-hash` on homepage — detected on mount, decompressed, jumps state machine to success view. No re-extraction. | ✓ |
| Hash fragment | `#w=hash` (URL fragment) instead of query param. Hash never leaves browser — quieter for privacy. Less standard. | |
| Re-extract on share | Share URL is just the original YouTube URL with auto-extract. Recipient sees loading. Cheaper bytes but every share triggers extraction. | |

**User's choice:** Query param hydration
**Notes:** Effectively makes the routing decision "single-page-with-hydration". Share recipients get instant view, no re-extraction cost.

### Long-URL fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Strip optional fields above threshold (Recommended) | If compressed payload >2KB, strip sourceQuote + form_cues. UI notice: 'Share link omits form cues for length.' Pragmatic. | ✓ |
| Hard limit + 'too long to share' error | Fail honestly. Simpler logic, worse UX. | |
| Always share + accept risk | Never truncate. Simplest implementation. Worst UX for edge cases. | |

**User's choice:** Strip optional fields above threshold
**Notes:** Strip order: sourceQuote → form_cues → equipment[]. Keep name/sets/reps/rest/supersets/header.

### Refresh behavior (no share param)

| Option | Description | Selected |
|--------|-------------|----------|
| Return to landing (Recommended) | State machine resets on reload. User sees fresh landing. Honest — workout was ephemeral. | ✓ |
| Auto re-extract from last URL | Backend re-runs extraction with last URL stored in localStorage. Pseudo-persistent but burns AI budget in Phase 2. | |
| localStorage cache | Last workout stored in localStorage on success; reload restores it. Risk: stale schema if migrations happen. | |

**User's choice:** Return to landing
**Notes:** Pairs with a subtle "Use Share to save this view" nudge after extraction. No localStorage of workouts in v1.

---

## Claude's Discretion

Areas where the user delegated specific calls to Claude during implementation:

- Exact accent-green hex within the #39FF14 family and its WCAG-tuned variants on glassmorphic surfaces
- Gradient orb color palette (the complementary colors besides the neon-green accent)
- Card stagger animation timing (50–80ms range) and spring vs. ease curve
- Specific YouTube creators / video titles inside the fixtures (realistic but not impersonating any real creator)
- Whether the share-link nudge is a toast vs. inline-below-CTA
- Exact mobile breakpoints for hero layout reflow

## Deferred Ideas

Captured during discussion but belong to other phases or v2+:

- Per-exercise jump-to-timestamp link (Phase 4 / POLI-01) — schema field locked in Phase 1 but UI deferred
- Source-quote popover (Phase 4 / POLI-02) — schema field locked in Phase 1 but UI deferred
- Equipment chips per exercise (Phase 4 / POLI-03) — schema field locked in Phase 1 but UI deferred
- localStorage of recently-extracted URLs (Phase 4 / POLI-07) — explicitly rejected for refresh behavior
- `/preview` route showing all UI states for design review — discussed but not selected (URL keywords used instead)
- "⚡ Cached" badge (Phase 4 / POLI-08) — depends on Phase 2's cache layer existing
- Sample-workouts preview strip on landing — rejected for v1 hero
- Mobile-glass perf fallback (reduced opacity, no backdrop-filter on low-power devices) — Phase 1 plans for this, defers full implementation to performance pass if real-device testing flags it
