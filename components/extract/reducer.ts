/**
 * Pure FSM reducer for ExtractFlow (D-15, D-16, D-19)
 *
 * States: idle | submitting | streaming | success | error
 * Actions: submit | stage | success | error | hydrate | reset
 *
 * D-15: single-page state machine; no /w/[id] route
 * D-16: hydrate action from share-link ?w= param → fromShareLink: true
 * D-19: reset returns initialState — no localStorage caching
 */

import type { Workout } from "@/lib/schema/workout";
import type { StripField } from "@/lib/schema/workout";

// ─── Stage order (must match MockExtractionService emit order) ───
export const STAGE_ORDER = [
  "fetching",
  "transcribing",
  "analyzing",
  "generating",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

// ─── Error codes from ExtractEventSchema ───
export type ErrorCode = "NETWORK" | "NO_WORKOUT" | "RATE_LIMITED" | "UNKNOWN";

// ─── State union ───
export type State =
  | { kind: "idle" }
  | { kind: "submitting"; url: string }
  | {
      kind: "streaming";
      url: string;
      currentStage: Stage;
      completedStages: ReadonlyArray<Stage>;
    }
  | {
      kind: "success";
      workout: Workout;
      fromShareLink: boolean;
      stripped: StripField[];
    }
  | { kind: "error"; code: ErrorCode; message: string };

// ─── Action union ───
export type Action =
  | { type: "submit"; url: string }
  | { type: "stage"; stage: Stage }
  | { type: "success"; workout: Workout }
  | { type: "hydrate"; workout: Workout; stripped: StripField[] }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "reset" };

export const initialState: State = { kind: "idle" };

/**
 * Pure reducer — no side effects.
 *
 * The `stage` action computes `completedStages` from
 * `STAGE_ORDER.slice(0, indexOf(action.stage))` so out-of-order stage events
 * still produce a consistent UI state (D-10 — UI consumes events, never timers).
 */
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "submit":
      return { kind: "submitting", url: action.url };

    case "stage": {
      const url = state.kind === "submitting" || state.kind === "streaming"
        ? state.url
        : "";
      const stageIndex = STAGE_ORDER.indexOf(action.stage);
      // All stages before current are "completed"
      const completedStages = STAGE_ORDER.slice(
        0,
        stageIndex < 0 ? 0 : stageIndex
      ) as readonly Stage[];
      return {
        kind: "streaming",
        url,
        currentStage: action.stage,
        completedStages,
      };
    }

    case "success":
      return {
        kind: "success",
        workout: action.workout,
        fromShareLink: false,
        stripped: [],
      };

    case "hydrate":
      return {
        kind: "success",
        workout: action.workout,
        fromShareLink: true,
        stripped: action.stripped,
      };

    case "error":
      return {
        kind: "error",
        code: action.code,
        message: action.message,
      };

    case "reset":
      return initialState;

    default:
      return state;
  }
}
