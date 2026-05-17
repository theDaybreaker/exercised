# Architecture Research

**Domain:** AI-powered YouTube workout-extraction web app (Next.js App Router on Vercel, mock-first → real pipeline)
**Researched:** 2026-05-16
**Confidence:** HIGH (Vercel limits, Next.js patterns, Zod, AI SDK verified against official docs; yt-dlp deployment options have MEDIUM confidence — multiple viable paths, recommendation depends on operational preferences)

---

## TL;DR — The Architecture in One Page

1. **Frontend shell is a Server Component**; one Client Component owns the entire `idle → submitting → streaming → success | error` state machine via `useReducer`. No Zustand, no URL state for v1.
2. **Single `/api/extract` route**, swap mock vs real behind a typed `ExtractionService` interface chosen by an env var. Frontend never knows the difference.
3. **The route streams an SSE-style response from day one** — even the mock emits the pipeline-stage updates. This is non-negotiable because real extraction takes 10–60s and the "Fetching → Transcribing → Analyzing → Generating" UX is part of the brief.
4. **Vercel's Fluid Compute (enabled by default on new projects in 2026) raises the Hobby duration cap to 300s.** The Pro-required-for-60s assumption is outdated. The pipeline fits comfortably in Hobby limits as long as Fluid Compute is on.
5. **Zod is the single source of truth.** `lib/schema/workout.ts` exports the schema; frontend, mock fixtures, and the real LLM call (`generateObject({ schema })`) all consume it.
6. **yt-dlp does NOT have to run in a Vercel function.** Three viable architectures laid out below. Recommended path: **try YouTube captions first (no yt-dlp needed); fall back to a Fly.io machine running yt-dlp + ffmpeg** behind a tiny HTTP API.
7. **Cache by `videoId` in Upstash Redis with 30-day TTL.** Same video → same workout → zero AI cost on cache hit. Layer in from day one of the real pipeline (Phase 2), not as polish.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                                │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────────┐   │
│  │  RSC: Landing   │   │ CC: ExtractFlow  │   │ CC: WorkoutView     │   │
│  │  (page.tsx,     │──▶│ (URL input,      │──▶│ (renders parsed     │   │
│  │  layout, nav)   │   │  state machine,  │   │  workout cards,     │   │
│  │                 │   │  SSE consumer)   │   │  supersets,         │   │
│  │  Static shell.  │   │                  │   │  form cue expand)   │   │
│  └─────────────────┘   └────────┬─────────┘   └─────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ POST /api/extract { url }
                                  │ (response: text/event-stream)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  VERCEL — Next.js App Router                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  app/api/extract/route.ts                                          │  │
│  │  - Validates input (Zod URL schema)                                │  │
│  │  - Picks ExtractionService from env (MOCK or REAL)                 │  │
│  │  - Returns ReadableStream → SSE events                             │  │
│  │  - export const dynamic = "force-dynamic"; maxDuration = 300       │  │
│  └────────────────────────┬───────────────────────────────────────────┘  │
│                           │                                              │
│        ┌──────────────────┴───────────────────┐                          │
│        ▼                                       ▼                          │
│  ┌──────────────┐                    ┌────────────────────┐              │
│  │ MockService  │                    │   RealService      │              │
│  │ - delay 3s   │                    │ ┌────────────────┐ │              │
│  │ - emit stage │                    │ │ 1. Cache check │ │              │
│  │   events     │                    │ │ 2. Captions    │ │              │
│  │ - return     │                    │ │    fallback to │ │              │
│  │   fixture    │                    │ │    audio path  │ │              │
│  └──────────────┘                    │ │ 3. Whisper     │ │              │
│                                       │ │ 4. LLM (Zod)   │ │              │
│                                       │ │ 5. Cache write │ │              │
│                                       │ └────────────────┘ │              │
│                                       └─┬──────┬─────┬─────┘              │
│                                         │      │     │                    │
└─────────────────────────────────────────┼──────┼─────┼────────────────────┘
                                          │      │     │
                                          ▼      ▼     ▼
                          ┌──────────────────┐ ┌─────────────┐ ┌────────────┐
                          │  Caption / Audio │ │  OpenAI     │ │  Upstash   │
                          │  Source (one of):│ │  Whisper +  │ │  Redis     │
                          │  - Supadata.ai   │ │  GPT-4o     │ │  (cache)   │
                          │  - Fly machine   │ │  (or Gemini)│ │            │
                          │    + yt-dlp      │ │             │ │  KV: video │
                          │  - Apify actor   │ │             │ │  Id → JSON │
                          └──────────────────┘ └─────────────┘ └────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **`app/page.tsx`** (RSC) | Static landing shell — hero, copy, footer, mounts `<ExtractFlow />` | React Server Component, no `"use client"` |
| **`<ExtractFlow />`** (CC) | Entire state machine: URL input → POST → SSE consumption → render `<WorkoutView />` or `<ErrorState />` | Client Component, `useReducer` |
| **`<WorkoutView />`** (CC) | Renders parsed workout — title, meta pills, exercise cards, supersets, form cue expansion | Client Component (for expand animation); pure render from props |
| **`/api/extract` route** | HTTP entry, input validation, service selection, SSE response stream | Next.js Route Handler returning `Response` with `ReadableStream` |
| **`ExtractionService` interface** | Contract both mock & real implement: `extract(url): AsyncIterable<ExtractEvent>` | TypeScript interface + factory function |
| **`MockExtractionService`** | Emits staged events with delays, returns fixture | Pure TS, no external deps |
| **`RealExtractionService`** | Orchestrates cache → caption/audio → Whisper → LLM → cache write, emitting events along the way | TS, calls Vercel AI SDK, OpenAI, Upstash, caption source |
| **`lib/schema/workout.ts`** | Zod schemas: `WorkoutSchema`, `ExtractRequestSchema`, `ExtractEventSchema` + inferred TS types | Pure Zod, no Next.js dependency |
| **Caption/audio source** | Fetches YouTube captions (preferred) or audio (fallback) — yt-dlp lives here, NOT in Vercel | External service (Fly machine, Apify, or Supadata) |
| **Upstash Redis** | Cache `videoId → WorkoutJSON` with 30-day TTL; later: rate limit per IP | HTTPS REST API, edge-friendly |

---

## Recommended Project Structure

```
exercised/
├── app/
│   ├── layout.tsx                  # Root layout — fonts (Inter/Outfit), dark theme
│   ├── page.tsx                    # RSC — landing shell, mounts <ExtractFlow />
│   ├── globals.css                 # Tailwind + design tokens (neon accents, glass)
│   └── api/
│       └── extract/
│           └── route.ts            # POST handler — SSE stream, service factory
├── components/
│   ├── extract/
│   │   ├── ExtractFlow.tsx         # "use client" — owns the state machine
│   │   ├── UrlInput.tsx            # Input + CTA, controlled by ExtractFlow
│   │   ├── LoadingStages.tsx       # Cycling "Fetching → Transcribing → …"
│   │   ├── ErrorState.tsx          # Empty / failure UX
│   │   └── reducer.ts              # Pure reducer for the state machine
│   ├── workout/
│   │   ├── WorkoutView.tsx         # Wraps header + list, pure render
│   │   ├── WorkoutHeader.tsx       # Title, creator, duration, muscle pills
│   │   ├── ExerciseCard.tsx        # Standard set card, expandable form cues
│   │   └── SupersetCard.tsx        # Bracketed group of nested exercises
│   └── ui/                         # shadcn primitives (Button, Card, Skeleton, …)
├── lib/
│   ├── schema/
│   │   └── workout.ts              # Zod: WorkoutSchema, ExtractEventSchema, types
│   ├── extraction/
│   │   ├── service.ts              # ExtractionService interface, factory
│   │   ├── mock.ts                 # MockExtractionService — uses fixtures/
│   │   ├── real.ts                 # RealExtractionService — pipeline orchestrator
│   │   ├── captions.ts             # YouTube captions fetcher (Supadata/Fly client)
│   │   ├── transcribe.ts           # Whisper wrapper
│   │   ├── structure.ts            # LLM call: generateObject({ schema, prompt })
│   │   └── cache.ts                # Upstash get/set wrappers, videoId derivation
│   ├── sse/
│   │   └── stream.ts               # Helper: ReadableStream + SSE encoder
│   └── youtube/
│       └── url.ts                  # Parse + validate YouTube URLs → videoId
├── fixtures/
│   ├── upper-body-hiit.json        # Example workout matching WorkoutSchema
│   └── superset-leg-day.json       # Edge case — supersets
├── public/                         # Static assets
├── .env.local                      # EXTRACT_MODE=mock|real, OPENAI_API_KEY, …
└── package.json
```

### Structure Rationale

- **`app/` is intentionally thin.** Only the route handler and page shells. All logic lives in `lib/` so it stays testable without Next.js.
- **`lib/extraction/` is the swap point.** Service factory in `service.ts` reads `process.env.EXTRACT_MODE`. Frontend imports nothing from here — it only sees the SSE stream from `/api/extract`.
- **`lib/schema/workout.ts` is the single source of truth.** Imported by `fixtures/*.json` (validated at boot), `lib/extraction/mock.ts`, `lib/extraction/structure.ts` (passed to `generateObject`), and the frontend type imports via `import type`.
- **`fixtures/*.json` are real files, not inline objects.** Lets us swap fixtures without code changes during UI iteration.
- **`components/extract/` vs `components/workout/`.** Extract owns the *flow*. Workout owns the *render*. WorkoutView receives parsed JSON as a prop and has no awareness of how it was obtained. This keeps the workout view 100% reusable if/when extraction moves to a background job in v2.

---

## Architectural Patterns

### Pattern 1: Server Component Shell + Single Client Island

**What:** The entire interactive flow is one `"use client"` boundary at `<ExtractFlow />`. Everything above is RSC.

**When to use:** Form-driven SPAs with a single primary interaction. This app is exactly that — paste, watch progress, see result.

**Trade-offs:**
- ✅ Server-rendered HTML for the landing (fast, SEO-friendly for marketing copy)
- ✅ Small client bundle — only the interactive parts ship JS
- ✅ Easy to reason about — no "is this server or client?" archaeology in components
- ❌ `<WorkoutView />` is technically a Client Component because its children animate, but it doesn't *need* state — accept this for now; the alternative (passing serialized JSON through an RSC boundary) is more complex

**Example:**
```tsx
// app/page.tsx — Server Component
import { ExtractFlow } from "@/components/extract/ExtractFlow";
import { Hero } from "@/components/marketing/Hero";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 to-black">
      <Hero />
      <ExtractFlow />  {/* The only client island */}
    </main>
  );
}
```

```tsx
// components/extract/ExtractFlow.tsx — Client Component
"use client";
import { useReducer } from "react";
import { reducer, initialState } from "./reducer";
// ...
```

---

### Pattern 2: `useReducer` State Machine, Not Zustand

**What:** All flow state (`idle | submitting | streaming | success | error`) lives in one reducer co-located with `<ExtractFlow />`.

**When to use:** When the state is local to a component subtree and the transitions are well-defined. Our state has 5 states and ~6 transitions — exactly the size where a reducer beats both `useState` (too many flags) and Zustand (overkill, no global state need).

**Trade-offs:**
- ✅ Zero dependencies
- ✅ Transitions are explicit and testable as pure functions
- ✅ Easy to log/debug — every state change is a typed action
- ✅ Trivial to migrate to XState later if states multiply
- ❌ Slightly more boilerplate than `useState`, but the trade is clarity at this size

**Example:**
```ts
// components/extract/reducer.ts
import type { Workout, ExtractEvent } from "@/lib/schema/workout";

export type State =
  | { kind: "idle" }
  | { kind: "submitting"; url: string }
  | { kind: "streaming"; url: string; stage: ExtractEvent["stage"] }
  | { kind: "success"; workout: Workout }
  | { kind: "error"; message: string; canRetry: boolean };

export type Action =
  | { type: "submit"; url: string }
  | { type: "stage"; stage: ExtractEvent["stage"] }
  | { type: "success"; workout: Workout }
  | { type: "error"; message: string }
  | { type: "reset" };

export const initialState: State = { kind: "idle" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "submit":
      return { kind: "submitting", url: action.url };
    case "stage":
      return state.kind === "submitting" || state.kind === "streaming"
        ? { kind: "streaming", url: (state as any).url, stage: action.stage }
        : state;
    case "success":
      return { kind: "success", workout: action.workout };
    case "error":
      return { kind: "error", message: action.message, canRetry: true };
    case "reset":
      return initialState;
  }
}
```

**Why not Zustand?** No state is shared across distant components. No persistence. No global selectors. Adding Zustand is dependency cost without benefit.

**Why not URL state?** A YouTube URL in the address bar (e.g., `/?v=dQw4w9WgXcQ`) *would* be nice for shareability, but it's a v1.1 polish — adds complexity (route param parsing, hydration race with the SSE state machine) without unlocking a validated use case in v1. Deferring.

---

### Pattern 3: Service Interface for Mock/Real Swap

**What:** A TypeScript interface that both implementations satisfy. The route handler picks via env var.

**When to use:** Whenever a real backend dependency is months away from the UI work that needs to consume it.

**Trade-offs:**
- ✅ Frontend ships against the mock and *never* changes when real lands
- ✅ Both implementations get the same type checks against the schema
- ✅ Single route — no `/api/extract-mock` vs `/api/extract` confusion in the frontend
- ❌ One extra layer of indirection (~30 LOC of glue)

**Example:**
```ts
// lib/extraction/service.ts
import type { ExtractEvent, Workout } from "@/lib/schema/workout";

export interface ExtractionService {
  extract(url: string): AsyncIterable<ExtractEvent>;
}

export function getExtractionService(): ExtractionService {
  const mode = process.env.EXTRACT_MODE ?? "mock";
  if (mode === "real") {
    // Lazy import keeps real-pipeline deps out of the mock bundle path
    return require("./real").RealExtractionService;
  }
  return require("./mock").MockExtractionService;
}
```

```ts
// lib/extraction/mock.ts
import fixture from "@/fixtures/upper-body-hiit.json";
import { WorkoutSchema, type ExtractEvent } from "@/lib/schema/workout";

const workout = WorkoutSchema.parse(fixture); // Validates fixture at module load

export const MockExtractionService = {
  async *extract(_url: string): AsyncIterable<ExtractEvent> {
    yield { type: "stage", stage: "fetching" };
    await sleep(800);
    yield { type: "stage", stage: "transcribing" };
    await sleep(1000);
    yield { type: "stage", stage: "analyzing" };
    await sleep(800);
    yield { type: "stage", stage: "generating" };
    await sleep(400);
    yield { type: "result", workout };
  },
};
```

The frontend never knows which implementation ran. To go real, set `EXTRACT_MODE=real` and provide `OPENAI_API_KEY` + caption-source credentials.

---

### Pattern 4: SSE for Pipeline Stages (Not Polling)

**What:** `/api/extract` returns a `text/event-stream` response. Each pipeline stage emits an event; the final `result` event carries the workout JSON.

**When to use:** Long-running server work where the client wants progress feedback. Exactly our case.

**Trade-offs:**
- ✅ Single HTTP request — no client-side polling loop, no Redis state machine for job IDs
- ✅ Works in Vercel Fluid Compute Functions with `maxDuration = 300` (Hobby) or 800 (Pro)
- ✅ Server-driven UX — backend dictates the stage names, frontend just renders
- ❌ One open connection per active extraction. Fine at v1 scale; if we ever hit serious concurrency, revisit with a job queue
- ❌ Needs `export const dynamic = "force-dynamic"` and `X-Accel-Buffering: no` headers, or Vercel buffers and breaks streaming

**Example:**
```ts
// app/api/extract/route.ts
import { ExtractRequestSchema } from "@/lib/schema/workout";
import { getExtractionService } from "@/lib/extraction/service";
import { toSSEStream } from "@/lib/sse/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Fluid Compute on Hobby/Pro

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const service = getExtractionService();
  const stream = toSSEStream(service.extract(parsed.data.url));

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

**Why not polling with a job ID?** Polling requires (a) a persistent job store, (b) a separate `/api/extract/status/:id` endpoint, (c) client polling logic. SSE collapses all three into one stream. We'd only switch if extraction routinely exceeded 300s — and if it does, the right answer is Vercel Workflows or a background queue, not polling.

**Why not WebSockets?** One-way (server → client) updates only. SSE is the simpler tool for the job and works natively with `fetch` + `ReadableStream` API.

---

### Pattern 5: Zod as the JSON Contract

**What:** One Zod schema in `lib/schema/workout.ts` defines `Workout`, `ExtractRequest`, and `ExtractEvent`. Types are inferred via `z.infer`.

**When to use:** Always, when the same data shape crosses the frontend/backend boundary and there's no DB ORM dictating shapes.

**Trade-offs:**
- ✅ One change updates types everywhere; no drift between mock fixture, LLM output, and frontend render
- ✅ Vercel AI SDK's `generateObject({ schema })` accepts Zod directly — the LLM is *constrained* to the schema at generation time, not just validated after
- ✅ Runtime validation catches LLM hallucinations (extra fields, wrong types) before they reach the UI
- ❌ Zod schemas can get verbose for discriminated unions (supersets) — worth it for type safety

**Example:**
```ts
// lib/schema/workout.ts
import { z } from "zod";

const StandardSetSchema = z.object({
  type: z.literal("standard_set"),
  exercise_name: z.string(),
  sets: z.number().int().positive(),
  reps: z.string(),                    // "10" or "8-12" or "AMRAP"
  rest_seconds: z.number().int().nonnegative(),
  form_cues: z.array(z.string()),
});

const SupersetExerciseSchema = z.object({
  exercise_name: z.string(),
  sets: z.number().int().positive(),
  reps: z.string(),
  form_cues: z.array(z.string()),
});

const SupersetSchema = z.object({
  type: z.literal("superset"),
  exercises: z.array(SupersetExerciseSchema).min(2),
  rest_seconds: z.number().int().nonnegative(),
});

export const RoutineItemSchema = z.discriminatedUnion("type", [
  StandardSetSchema,
  SupersetSchema,
]);

export const WorkoutSchema = z.object({
  workout_title: z.string(),
  creator_username: z.string(),
  target_muscles: z.array(z.string()),
  estimated_duration_mins: z.number().int().positive(),
  routine: z.array(RoutineItemSchema).min(1),
});

export const ExtractRequestSchema = z.object({
  url: z.string().url(),
});

export const ExtractEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stage"),
    stage: z.enum(["fetching", "transcribing", "analyzing", "generating"]),
  }),
  z.object({ type: z.literal("result"), workout: WorkoutSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type Workout = z.infer<typeof WorkoutSchema>;
export type ExtractEvent = z.infer<typeof ExtractEventSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
```

---

## Data Flow

### Request Flow (Success Path)

```
1. User pastes URL, clicks "Extract Workout"
       ↓
2. <ExtractFlow /> dispatches { type: "submit", url }
   State: idle → submitting
       ↓
3. fetch("/api/extract", { method: "POST", body: { url } })
       ↓
4. Route handler validates URL with ExtractRequestSchema
       ↓
5. Route handler calls getExtractionService().extract(url)
       ↓
6. AsyncIterable<ExtractEvent> is wrapped in a ReadableStream → SSE
   Response sent immediately (this is what unlocks streaming on Vercel)
       ↓
7. Each yield emits a `data: <json>\n\n` chunk
   Mock: timed yields. Real: yields as pipeline stages complete.
       ↓
8. <ExtractFlow /> reads with res.body.getReader() + TextDecoder
   For each event, dispatch to reducer:
     stage events → State: streaming, advance stage indicator
     result event → State: success, render <WorkoutView workout={...} />
     error event  → State: error, render <ErrorState />
```

### Real-Pipeline Internal Flow

```
RealExtractionService.extract(url):

   yield "stage: fetching"
       ↓
   videoId = parseYouTubeUrl(url)
       ↓
   cached = await cache.get(videoId)
   if cached: yield "result"; return       ← cache hit, ~5s total UX
       ↓
   captions = await fetchCaptions(videoId) ← Supadata or Fly machine
       ↓
   if captions exists:
       transcript = captions
   else:
       yield "stage: transcribing"
       audioUrl = await fetchAudioUrl(videoId)  ← Fly machine (yt-dlp → ffmpeg → mp3)
       transcript = await whisper.transcribe(audioUrl)
       ↓
   yield "stage: analyzing"
       ↓
   yield "stage: generating"
       ↓
   workout = await generateObject({
       model: openai("gpt-4o"),
       schema: WorkoutSchema,
       prompt: STRUCTURING_PROMPT(transcript, videoMetadata)
   })
       ↓
   await cache.set(videoId, workout, { ex: 30 * 24 * 3600 })
       ↓
   yield "result: workout"
```

### State Management

No global state. State lives entirely inside `<ExtractFlow />`:

```
[user event]                  [server event (SSE)]
     ↓                                ↓
   dispatch(submit)            dispatch(stage | success | error)
     ↓                                ↓
            useReducer(reducer, initialState)
                    ↓
               new State
                    ↓
       conditional render based on state.kind:
         idle       → <UrlInput />
         submitting → <UrlInput disabled /> + <LoadingStages />
         streaming  → <LoadingStages stage={...} />
         success    → <WorkoutView workout={state.workout} />
         error      → <ErrorState onRetry={() => dispatch(reset)} />
```

### Key Data Flows

1. **Mock → UI:** Fixture JSON (`fixtures/upper-body-hiit.json`) → `WorkoutSchema.parse` at module load → `MockExtractionService` yields it via SSE → `<ExtractFlow />` dispatches → `<WorkoutView />` renders.
2. **Real → UI:** YouTube URL → caption-or-audio source → transcript → LLM with Zod schema constraint → validated `Workout` object → same SSE path as mock → same render path.
3. **Cache hit → UI:** YouTube URL → `videoId` derivation → Upstash GET → if hit, yield single `result` event → ~5s total UX (vs 15–30s cold).

---

## Long-Running Extraction: Concrete Architecture

This is the question that drives every other decision. Direct answer.

### What actually matters in 2026

| Plan | Default | Max with Fluid Compute | Without Fluid Compute |
|------|---------|------------------------|------------------------|
| Hobby | **300s** | **300s** | 10s (legacy default) |
| Pro | 300s | 800s | 60s (legacy default) |

**Fluid Compute is on by default on new Vercel projects.** The "10s on Hobby" assumption in the milestone context is outdated as of 2026-02. Source: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations).

### Decision: Streaming HTTP response with SSE

For a 10–30s extraction (and even worst-case ~60s with audio download + Whisper on a long video), a single streamed response handler is the right answer.

- **Hobby plan is sufficient** for v1 demo (300s ceiling).
- **No background job, no Redis-backed job queue, no separate status endpoint.**
- The SSE pattern doubles as the "Fetching → Transcribing → Analyzing → Generating" UX from the brief — the stages aren't fake, they're the actual pipeline steps.

### When to revisit

- If extraction routinely exceeds 90s (e.g., 30-minute workout videos with no captions requiring full audio transcription), evaluate moving the audio-transcription leg to a background job and polling. Trigger threshold: p95 extraction > 90s in production.
- If concurrency becomes an issue (each active SSE stream holds a function instance), consider Vercel Workflows. Trigger threshold: concurrent extractions sustained > 100 (well past v1 needs).

---

## yt-dlp Execution Location: Three Viable Architectures

yt-dlp is a Python binary. The 250 MB unzipped Vercel function size limit is a soft no — even if you can squeeze it in, cold starts will suffer and you're tying your fastest deploy target to a finicky dependency. **It needs to live elsewhere.**

Three architectures, ordered by complexity. **Recommendation: start with Option A, fall back to B if quality is insufficient.**

### Option A — Hosted Transcript API (Supadata or Apify) ⭐ Recommended start

**Architecture:**
```
Vercel /api/extract → HTTPS → Supadata API → transcript
                                            (or Apify YouTube Transcript Scraper)
                                            ↓
                                     (no yt-dlp infra to run)
```

**What it does:** Hosted service handles caption fetching AND Whisper-fallback when captions are missing. Returns plain-text transcript.

**Pricing signal (verify before committing):**
- Supadata: free tier 100 requests, then paid; AI-fallback when captions unavailable.
- Apify YouTube Transcript Scraper + Whisper fallback: ~$0.001/video.

**Tradeoffs:**
- ✅ Zero infra to maintain. Single HTTPS call from the Vercel function.
- ✅ Bypasses Whisper costs when captions exist (the service does the fallback logic).
- ✅ Time to first real extraction: hours.
- ❌ Per-request cost (low, but recurring).
- ❌ Vendor lock — if Supadata/Apify changes pricing or breaks, you're stuck rebuilding.
- ❌ Less control over which audio segments are transcribed (some workouts have a long intro you'd want to skip).

**When to use:** v1 demo through early validation. Switch only if (a) cost becomes material at scale, or (b) you need transcript control the API doesn't offer.

---

### Option B — Fly.io Machine (Sidecar) with yt-dlp + ffmpeg

**Architecture:**
```
Vercel /api/extract → HTTPS → Fly Machine (`https://yt.exercised.fly.dev`)
                              ┌──────────────────────────────┐
                              │ Tiny Node/Python HTTP server │
                              │ POST /transcript { videoId } │
                              │   → run yt-dlp --write-subs  │
                              │   → return XML/SRT text      │
                              │ POST /audio { videoId }      │
                              │   → yt-dlp + ffmpeg → mp3    │
                              │   → upload to S3 / R2        │
                              │   → return signed URL        │
                              └──────────────────────────────┘
```

**What it does:** A Fly.io machine (cheap; auto-stops when idle) runs a small HTTP API that wraps yt-dlp + ffmpeg.

**Tradeoffs:**
- ✅ Full control. Update yt-dlp the moment YouTube breaks something.
- ✅ Very cheap at low traffic — Fly machines suspend when idle.
- ✅ Can stream audio to Whisper directly (no S3 round-trip if you do it inline).
- ✅ Vercel + Fly is the recommended pattern for "frontend on Vercel, stateful workers on Fly" — see [Fly vs Vercel](https://uibakery.io/blog/fly-io-vs-vercel).
- ❌ One more service to operate (deploy pipeline, secrets, monitoring).
- ❌ First request after idle has a wake-up cost (~1–2s).
- ❌ If YouTube rate-limits the Fly machine's IP, you'll need rotating IPs or residential proxies — non-trivial.

**When to use:** When hosted APIs (Option A) become expensive, fail in your use case, or you need first-class control over yt-dlp behavior.

---

### Option C — Standalone API on Render / Railway

**Architecture:** Same as Option B, but on Render or Railway instead of Fly. Persistent container that doesn't auto-suspend.

**Tradeoffs:**
- ✅ Simpler deploy than Fly for some teams (auto-deploys from git).
- ❌ No auto-suspend — small but constant idle cost (~$5–7/mo).
- ❌ Less "serverless feel" than Fly machines.
- ❌ Same IP-blocking risk as Option B.

**When to use:** If the team has existing Render/Railway tooling and doesn't want to learn Fly. Functionally equivalent to Option B otherwise.

---

### Architecture for v1: Option A → fall back to Option B

```
Phase 2 (real pipeline lands):
    Try Supadata/Apify first.
    If quality is good AND cost is acceptable: ship it.
    If captions/transcript quality is poor for fitness content:
        Stand up Option B (Fly machine + yt-dlp + Whisper).
```

This sequencing maximizes time-to-shippable while keeping the escape hatch open.

---

## Caching Strategy

### Direct answer: Yes, cache from day one of Phase 2

YouTube URL → same `videoId` → deterministic workout. Caching is the highest-leverage cost optimization in the system.

### Design

| Aspect | Value | Rationale |
|--------|-------|-----------|
| Store | Upstash Redis (via Vercel marketplace integration) | One-click provision; REST API works from any function; same store can later host rate-limiting counters |
| Key | `workout:v1:${videoId}` | Versioned prefix lets us invalidate on schema changes without flushing the store |
| Value | JSON-serialized `Workout` (validated by `WorkoutSchema.parse` on read) | Re-validates on read so a schema change surfaces immediately |
| TTL | 30 days | Workout content is essentially immutable per video; 30 days bounds storage cost while letting us re-extract if we improve the prompt |
| Cache check position | First step of `RealExtractionService.extract()`, *after* URL validation, *before* any external call | Cache hit → ~5s UX, zero AI cost |

### Cost implication

A single GPT-4o + Whisper extraction is order-of-magnitude $0.01–$0.10 depending on transcript length. A cache hit is order-of-magnitude $0.0001 (one Upstash read). **At any meaningful share-rate (e.g., a video that goes viral), cache eliminates 99%+ of duplicate cost.**

### Cache + rate-limit double duty

The same Upstash instance handles per-IP rate limiting in a later phase. One service, two purposes.

---

## Build Order

Given the mock-first strategy, the dependency chain dictates the order. Don't reorder these — each step unlocks the next.

```
1. Schema + fixtures
   ├── lib/schema/workout.ts (Zod)
   ├── fixtures/upper-body-hiit.json
   └── fixtures/superset-leg-day.json
        ↓ (unlocks: typed everything)

2. Mock /api/extract + SSE
   ├── lib/sse/stream.ts
   ├── lib/extraction/service.ts
   ├── lib/extraction/mock.ts
   └── app/api/extract/route.ts
        ↓ (unlocks: backend contract is real, frontend can integrate)

3. UI shell + state machine
   ├── app/layout.tsx (fonts, theme)
   ├── app/page.tsx (RSC shell)
   ├── components/extract/ExtractFlow.tsx (+ reducer)
   ├── components/extract/UrlInput.tsx
   └── components/extract/LoadingStages.tsx
        ↓ (unlocks: working idle → loading roundtrip)

4. Workout rendering
   ├── components/workout/WorkoutView.tsx
   ├── components/workout/WorkoutHeader.tsx
   ├── components/workout/ExerciseCard.tsx
   └── components/workout/SupersetCard.tsx
        ↓ (unlocks: full mock demo deployable to Vercel — SHIPPABLE)

5. Error & edge states
   ├── components/extract/ErrorState.tsx
   ├── Empty caption / unsupported URL handling
   └── Retry UX
        ↓ (unlocks: production-grade mock demo)

────────────── End of Phase 1, mock demo is live ──────────────

6. Real pipeline — captions path (cheapest)
   ├── lib/youtube/url.ts (parse videoId)
   ├── lib/extraction/captions.ts (Supadata client)
   ├── lib/extraction/structure.ts (Vercel AI SDK + generateObject)
   └── lib/extraction/real.ts (orchestrator, captions branch only)
        ↓ (unlocks: most YouTube workout videos extract for ~$0.01)

7. Real pipeline — audio fallback (when captions missing)
   ├── lib/extraction/transcribe.ts (Whisper)
   └── Decision point: which yt-dlp host?
       → Supadata's AI fallback handles this automatically (Option A)
       → OR Fly.io machine setup (Option B)
        ↓ (unlocks: 100% YouTube coverage)

8. Caching
   ├── lib/extraction/cache.ts (Upstash)
   └── Cache check at top of real.ts; cache write at bottom
        ↓ (unlocks: 99% cost reduction on repeat URLs)

9. Rate limiting
   ├── middleware.ts (per-IP rate limit on /api/extract)
   └── Upstash @ratelimit
        ↓ (unlocks: safe to put a real demo on the open internet)
```

### Critical sequencing notes

- **Steps 1–5 are pure frontend + mock.** No AI cost, no external dependencies, can ship to Vercel after step 5.
- **Step 6 before step 7.** Captions cover the majority of fitness videos and are 10× cheaper than Whisper. Don't build the audio path first.
- **Caching (step 8) before rate limiting (step 9).** Cache reduces the *legitimate* request volume; rate limit caps the *abuse* volume. Cache first because it improves UX for real users too.
- **Don't introduce a job queue yet.** It's the right answer at scale but premature for v1. Trigger: p95 latency > 90s sustained.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Current architecture as-is. Vercel Hobby + Upstash free tier likely sufficient. |
| 1k–10k users (viral moment) | Move Vercel to Pro for 4 GB memory headroom on the extract function. Increase Upstash plan. If captions API gets expensive, switch to Option B (Fly + yt-dlp). |
| 10k–100k users | Introduce a job queue (Vercel Workflows or Inngest) — extract becomes "submit → job ID → poll/SSE for result". This decouples the heavy Whisper/LLM work from the HTTP roundtrip. Add CDN-level caching of common workout results. |
| 100k+ users | This product almost certainly has accounts and a DB by this point — out of v1 scope. |

### Scaling Priorities

1. **First bottleneck: AI cost.** Hit by viral sharing. Mitigated by aggressive caching (already in design) + per-IP rate limiting.
2. **Second bottleneck: concurrent SSE streams.** Each open extraction holds a function instance. At sustained ~100+ concurrent extractions, move to a job-queue model.
3. **Third bottleneck: YouTube IP-blocking the yt-dlp host.** Only relevant if on Option B/C. Mitigation: rotate IPs or use residential proxy on the Fly machine.

---

## Anti-Patterns

### Anti-Pattern 1: "Just make the whole page a Client Component"

**What people do:** Slap `"use client"` on `app/page.tsx` because "there's interactivity on the page anyway."

**Why it's wrong:** Cascades the client bundle to everything imported by the page. Loses SEO and first-render speed for marketing copy that doesn't need state. Defeats the App Router's main benefit.

**Do this instead:** Keep `page.tsx` as RSC. Push the `"use client"` boundary down to `<ExtractFlow />` only.

---

### Anti-Pattern 2: Two routes — `/api/extract-mock` and `/api/extract`

**What people do:** During mock-first development, create a separate mock route. When real lands, change the frontend to point at the new route.

**Why it's wrong:** The frontend now has a knowledge of which mode is active. Every environment (local dev, preview, prod) has to be configured at two layers. Frontend changes accompany every backend swap.

**Do this instead:** Single `/api/extract` route. Service factory inside the route picks the implementation from an env var. Frontend never changes.

---

### Anti-Pattern 3: Polling for a long-running job when a single stream would do

**What people do:** Build `POST /api/extract` returning a job ID, then `GET /api/extract/status/:id` polled every 2s, with Redis-backed job state.

**Why it's wrong:** Adds a state store, two endpoints, a polling loop in the client, and extra infrastructure — all for a ~30s job that fits within a single Fluid Compute function call.

**Do this instead:** SSE in a single route. Move to polling only if extraction crosses the 300s ceiling regularly.

---

### Anti-Pattern 4: TypeScript interface for `Workout` + Zod schema separately

**What people do:** Hand-write a `Workout` TypeScript interface for the frontend, and a Zod schema for the backend. Both describe the same shape.

**Why it's wrong:** They drift. Every schema change requires two edits. The whole point of Zod-first is to have one definition.

**Do this instead:** Define the Zod schema. Export `type Workout = z.infer<typeof WorkoutSchema>`. Use the type everywhere.

---

### Anti-Pattern 5: Putting yt-dlp in the Vercel function "just to ship"

**What people do:** Bundle yt-dlp into the Next.js project to avoid setting up a second service.

**Why it's wrong:** Vercel's 250 MB unzipped function limit; cold-start penalty; binary execution from the Vercel sandbox is fragile; you can't update yt-dlp independently of the app.

**Do this instead:** Use a hosted transcript API for v1. If you truly need yt-dlp control, run it on Fly/Render — separate deploy lifecycle.

---

### Anti-Pattern 6: No cache on the real pipeline because "we don't have a DB"

**What people do:** Skip caching because "v1 has no database."

**Why it's wrong:** Conflates a cache (ephemeral KV) with a database (durable, relational). Upstash is one HTTPS endpoint; integrating it is the same effort as integrating OpenAI. Without it, every share of a popular video re-spends Whisper + LLM dollars.

**Do this instead:** Upstash Redis with TTL'd keys. It's not a database — it's a cost-saving cache.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI (Whisper + GPT-4o) | Vercel AI SDK (`@ai-sdk/openai`) via REST | `generateObject({ model, schema, prompt })` — Zod schema is the constraint |
| Upstash Redis | `@upstash/redis` HTTPS REST client | Works from any function, no connection pooling needed; provisioned via Vercel marketplace |
| YouTube captions (Supadata) | HTTPS REST, API key auth | Returns text/SRT; verify per-video pricing before relying on it |
| yt-dlp host (Fly, if used) | Internal HTTPS API on a private domain | Secure with a shared bearer token in `Authorization` header; rotate keys via env vars |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `<ExtractFlow />` ↔ `/api/extract` | HTTP POST + SSE stream | The only frontend-backend wire; Zod-typed on both sides |
| Route handler ↔ `ExtractionService` | TS interface, in-process call | Service factory selects mock vs real |
| `RealExtractionService` ↔ caption/audio source | HTTPS, typed wrapper in `lib/extraction/captions.ts` | Swap target without touching orchestrator |
| `RealExtractionService` ↔ Whisper / LLM | Vercel AI SDK | Model name and prompt centralized in `lib/extraction/structure.ts` |
| `RealExtractionService` ↔ Cache | `lib/extraction/cache.ts` wrapper | get/set, TTL, key derivation in one place |

---

## Sources

- [Vercel Functions Limits — current Hobby/Pro/Fluid Compute caps](https://vercel.com/docs/functions/limitations) — HIGH confidence, official
- [Vercel: Higher defaults and limits for Functions running Fluid Compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) — HIGH confidence, official changelog
- [Next.js Streaming Guides — App Router](https://nextjs.org/docs/app/guides/streaming) — HIGH confidence, official
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — HIGH confidence, official
- [Next.js `use client` directive reference](https://nextjs.org/docs/app/api-reference/directives/use-client) — HIGH confidence, official
- [Vercel AI SDK — generateObject reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) — HIGH confidence, official
- [Vercel AI SDK — Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — HIGH confidence, official
- [Upstash on Vercel Marketplace](https://vercel.com/marketplace/upstash) — HIGH confidence, official integration
- [Vercel AI SDK Caching](https://ai-sdk.dev/docs/advanced/caching) — HIGH confidence
- [SSE in Next.js Route Handlers](https://upstash.com/blog/sse-streaming-llm-responses) — MEDIUM confidence, vendor blog with code examples
- [Fixing slow SSE streaming on Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) — MEDIUM confidence, community write-up confirming `dynamic = "force-dynamic"` and `X-Accel-Buffering: no` requirements
- [Yozora — yt-dlp on Vercel functions (existence proof, not a recommendation)](https://github.com/ectora/yozora) — MEDIUM confidence
- [Vercel 250 MB function size limit guide](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit) — HIGH confidence, official
- [Fly.io vs Vercel — pattern of "Vercel frontend + Fly workers"](https://uibakery.io/blog/fly-io-vs-vercel) — MEDIUM confidence, third-party but widely-corroborated pattern
- [Supadata — YouTube transcript API with AI fallback](https://supadata.ai/) — MEDIUM confidence, vendor site (verify pricing before commit)
- [Apify — YouTube Transcript Scraper + Whisper](https://apify.com/codepoetry/youtube-transcript-ai-scraper) — MEDIUM confidence, vendor listing
- [State machines with useReducer (Kyle Shevlin)](https://kyleshevlin.com/how-to-use-usereducer-as-a-finite-state-machine/) — MEDIUM confidence, well-regarded community pattern
- [Shared Zod schemas frontend/backend](https://dev.to/jussinevavuori/end-to-end-typesafe-apis-with-typescript-and-shared-zod-schemas-4jmo) — MEDIUM confidence, community-validated pattern

---
*Architecture research for: AI-powered YouTube workout-extraction web app (Next.js + Vercel, mock-first → real pipeline)*
*Researched: 2026-05-16*
