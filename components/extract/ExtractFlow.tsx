"use client";

/**
 * ExtractFlow — Single Client island that owns:
 * - useReducer FSM (idle | submitting | streaming | success | error)
 * - fetch().body.pipeThrough(TextDecoderStream).getReader() SSE loop
 * - share-link hydration on mount via ?w= + decodeShareUrl (D-16)
 * - renders one of: UrlInput / LoadingStages / WorkoutView / error fallback
 *
 * D-10: UI consumes SSE events — never timers.
 * D-15: single-page state machine on route /.
 * D-16: on mount, reads window.location.search ?w= → dispatches hydrate.
 * D-19: reset returns initialState (refresh without ?w resets to idle).
 */

import { useReducer, useRef, useEffect } from "react";
import { reducer, initialState } from "@/components/extract/reducer";
import { UrlInput } from "@/components/extract/UrlInput";
import { LoadingStages } from "@/components/extract/LoadingStages";
import { WorkoutView } from "@/components/workout/WorkoutView";
import { ExtractEventSchema } from "@/lib/schema/workout";
import { decodeShareUrl } from "@/lib/share/decode";

export function ExtractFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // D-16 share-link hydration on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const w = searchParams.get("w");
    if (w) {
      try {
        const { workout, stripped } = decodeShareUrl(w);
        dispatch({ type: "hydrate", workout, stripped });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Invalid share link";
        dispatch({ type: "error", code: "UNKNOWN", message });
      }
    }
  }, []);

  async function handleSubmit(url: string) {
    // Abort any in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({ type: "submit", url });

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        let message = "Extraction failed";
        try {
          const errJson = await res.json();
          message = errJson.error ?? message;
        } catch {
          // ignore parse error
        }
        dispatch({ type: "error", code: "UNKNOWN", message });
        return;
      }

      // SSE consumer — fetch().body.pipeThrough(TextDecoderStream).getReader()
      const reader = res.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;

        // Split on double-newline (SSE message boundary)
        const messages = buffer.split("\n\n");
        // Keep the incomplete last segment in the buffer
        buffer = messages.pop() ?? "";

        for (const msg of messages) {
          // Find the data line
          const dataLine = msg
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = ExtractEventSchema.parse(JSON.parse(jsonStr));

            if (event.type === "stage") {
              dispatch({ type: "stage", stage: event.stage });
            } else if (event.type === "result") {
              dispatch({ type: "success", workout: event.workout });
            } else if (event.type === "error") {
              dispatch({
                type: "error",
                code: event.code,
                message: event.message,
              });
            }
          } catch {
            // Malformed event — ignore and continue reading
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      dispatch({
        type: "error",
        code: "NETWORK",
        message: "Connection failed. Please try again.",
      });
    }
  }

  // Render based on FSM state
  if (state.kind === "idle") {
    return <UrlInput onSubmit={handleSubmit} isLoading={false} />;
  }

  if (state.kind === "submitting") {
    return (
      <LoadingStages
        currentStage="fetching"
        completedStages={[]}
      />
    );
  }

  if (state.kind === "streaming") {
    return (
      <LoadingStages
        currentStage={state.currentStage}
        completedStages={state.completedStages}
      />
    );
  }

  if (state.kind === "success") {
    return (
      <WorkoutView
        workout={state.workout}
        shouldAnimateIn={!state.fromShareLink}
      />
    );
  }

  if (state.kind === "error") {
    // Minimal error fallback — full ErrorState UI ships in Plan 01-03
    return (
      <div className="glass-card px-6 py-6 text-center" role="alert">
        <p
          className="mb-4 text-base"
          style={{ color: "var(--color-text-primary)" }}
        >
          Sorry, something went wrong: {state.message}
        </p>
        <button
          onClick={() => dispatch({ type: "reset" })}
          className="text-sm underline"
          style={{ color: "var(--color-accent)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  return null;
}
