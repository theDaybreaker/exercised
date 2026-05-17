/**
 * encodeShareUrl — compress workout to URL-safe lz-string for ?w= share links.
 *
 * W6: Plan 01-02 ships the wrapper-encoded shape with a no-op strip-chain
 * placeholder. The wire format is { workout, stripped } from day one so
 * Plan 01-04's strip-chain addition is an internal-only change.
 *
 * D-17: strip chain — sourceQuote → form_cues → equipment (Plan 01-04)
 *   If compressed payload exceeds 2KB, progressively strips optional fields
 *   in STRIP_ORDER until it fits. Best-effort: if all 3 stripped and still
 *   over 2KB, returns the fully-stripped payload (no throw).
 */

import LZString from "lz-string";
import type { Workout, StripField, SharePayload, RoutineItem } from "@/lib/schema/workout";

// Strip order is locked by D-17 verbatim
export const STRIP_ORDER: StripField[] = ["sourceQuote", "form_cues", "equipment"];

export const MAX_PAYLOAD_BYTES = 2048;

export function encodeShareUrl(workout: Workout): {
  encoded: string;
  stripped: StripField[];
} {
  const strippedFields: StripField[] = [];
  let candidate = workout;

  // D-17 strip chain: try encoding, strip next field if over threshold, repeat
  // Loop runs STRIP_ORDER.length + 1 times (once unstripped + once per field)
  for (let attempt = 0; attempt <= STRIP_ORDER.length; attempt++) {
    const payload: SharePayload = { workout: candidate, stripped: strippedFields };
    const json = JSON.stringify(payload);
    const compressed = LZString.compressToEncodedURIComponent(json);

    // If fits under threshold, or we've exhausted all strip options: return
    if (compressed.length <= MAX_PAYLOAD_BYTES || attempt === STRIP_ORDER.length) {
      return { encoded: compressed, stripped: [...strippedFields] };
    }

    // Strip the next field
    const field = STRIP_ORDER[attempt];
    strippedFields.push(field);
    candidate = stripField(candidate, field);
  }

  // Unreachable — the loop always returns above
  throw new Error("encodeShareUrl: unreachable");
}

/**
 * Strip a single optional field from all exercises in the workout.
 * Handles both standard_set and superset routine items.
 */
function stripField(workout: Workout, field: StripField): Workout {
  return {
    ...workout,
    routine: workout.routine.map((item): RoutineItem => {
      if (item.type === "standard_set") {
        if (field === "sourceQuote") return { ...item, sourceQuote: null };
        if (field === "form_cues") return { ...item, form_cues: [] };
        if (field === "equipment") return { ...item, equipment: [] };
        return item;
      }
      // superset — strip each inner exercise
      return {
        ...item,
        exercises: item.exercises.map((ex) => {
          if (field === "sourceQuote") return { ...ex, sourceQuote: null };
          if (field === "form_cues") return { ...ex, form_cues: [] };
          if (field === "equipment") return { ...ex, equipment: [] };
          return ex;
        }),
      };
    }),
  };
}
