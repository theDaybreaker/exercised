# Exercised

A premium web app that converts social-media workout videos into structured, viewable workout routines. Paste a YouTube URL and an AI pipeline (yt-dlp → Whisper → LLM) parses the spoken/captioned content. The app renders the workout as an interactive card list — exercise names, sets/reps, rest, form cues, and supersets — in a sleek dark-mode UI.

**Core value:** Paste a YouTube workout video URL → see a clean, structured, readable workout in seconds.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Paste any YouTube workout URL and press Enter (or click "Extract Workout") to see the demo.

The development server runs in mock mode (`EXTRACT_MODE=mock`) by default — no API keys needed. The mock service streams a simulated SSE loading cascade (Fetching → Transcribing → Analyzing → Generating) over ~4–5 seconds, then renders the dumbbell leg-day fixture.

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Production build
pnpm build
```

## Deployment

Vercel auto-deploys from `main` via GitHub integration. No additional configuration is required beyond the following environment variable:

| Variable | Value | Scope |
|----------|-------|-------|
| `EXTRACT_MODE` | `mock` | Preview + Production |

Set this in the Vercel dashboard under Project → Settings → Environment Variables. The Phase 1 demo is mock-only — no OpenAI API key is required. The real extraction pipeline ships in Phase 2.

See `.env.example` for the full list of environment variables.

## Architecture

Locked architectural decisions are documented in:
`.planning/phases/01-mock-deployable-premium-ui-demo/01-SKELETON.md`

Key decisions:
- **Single Client island**: `<ExtractFlow />` owns `useReducer` FSM, SSE consumer loop, and share-link hydration
- **Schema as contract**: `lib/schema/workout.ts` (Zod) is the single source of truth shared between the mock API, real API, and UI
- **SSE streaming**: `POST /api/extract` streams `text/event-stream` with Node.js runtime + Fluid Compute (300s timeout)
- **Share URLs**: lz-string `compressToEncodedURIComponent` against the `SharePayloadSchema` wrapper (stable wire format across Phase 1)
- **Mock/real swap**: `EXTRACT_MODE` env var selects between `MockExtractionService` and `RealExtractionService` (Phase 2)
