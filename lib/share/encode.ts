/**
 * encodeShareUrl — compress workout to URL-safe lz-string for ?w= share links.
 *
 * W6: Plan 01-02 ships the wrapper-encoded shape with a no-op strip-chain
 * placeholder. The wire format is { workout, stripped } from day one so
 * Plan 01-04's strip-chain addition is an internal-only change.
 *
 * D-17: strip chain ships in Plan 01-04 — the TODO comment below marks the
 * exact spot where Plan 01-04 will add the loop body.
 */

import LZString from "lz-string";
import type { Workout, StripField, SharePayload } from "@/lib/schema/workout";

// Defined upfront for Plan 01-04 — the strip order determines which fields
// are dropped first when the payload exceeds 2KB
const STRIP_ORDER: StripField[] = ["sourceQuote", "form_cues", "equipment"];
const MAX_PAYLOAD_BYTES = 2048;

export function encodeShareUrl(workout: Workout): {
  encoded: string;
  stripped: StripField[];
} {
  // TODO(Plan 01-04): implement the D-17 strip chain loop here. For Plan 01-02,
  // we wrap the workout in SharePayloadSchema with stripped:[] and ship — the
  // dumbbell baseline fixture fits comfortably under 2KB so no stripping needed.
  const stripped: StripField[] = [];
  const payload: SharePayload = { workout, stripped };
  const json = JSON.stringify(payload);
  const encoded = LZString.compressToEncodedURIComponent(json);
  return { encoded, stripped };
}
