/**
 * noticeText — shared formatter for the D-17 strip notice copy.
 *
 * Used by both:
 * - ActionBar (sender toast description)
 * - ShareStripNotice (recipient inline notice above header)
 *
 * D-17 verbatim copy variants:
 *   "Share link omits source quotes for length."   — only sourceQuote stripped
 *   "Share link omits form cues for length."       — form_cues stripped (with or without sourceQuote)
 *   "Share link omits source quotes, form cues, and equipment for length." — all 3 stripped
 */

import type { StripField } from "@/lib/schema/workout";

const DISPLAY_NAMES: Record<StripField, string> = {
  sourceQuote: "source quotes",
  form_cues: "form cues",
  equipment: "equipment",
};

/**
 * Returns the notice copy for a given set of stripped fields.
 * Returns empty string when stripped is empty (no notice needed).
 *
 * Preferred variants per D-17 verbatim:
 * - ["sourceQuote"] → "Share link omits source quotes for length."
 * - includes "form_cues" → "Share link omits form cues for length." (D-17 verbatim main case)
 * - all 3 → "Share link omits source quotes, form cues, and equipment for length."
 */
export function noticeText(stripped: StripField[]): string {
  if (stripped.length === 0) return "";

  // All 3 stripped — full list
  if (stripped.includes("equipment")) {
    const parts = stripped.map((f) => DISPLAY_NAMES[f]);
    // Oxford-comma join: "source quotes, form cues, and equipment"
    if (parts.length === 1) {
      return `Share link omits ${parts[0]} for length.`;
    }
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1).join(", ");
    return `Share link omits ${rest}, and ${last} for length.`;
  }

  // form_cues stripped (with or without sourceQuote) — D-17 verbatim main case
  if (stripped.includes("form_cues")) {
    return "Share link omits form cues for length.";
  }

  // Only sourceQuote stripped
  if (stripped.includes("sourceQuote")) {
    return "Share link omits source quotes for length.";
  }

  // Fallback for any unexpected single-field strip
  const names = stripped.map((f) => DISPLAY_NAMES[f]).join(", ");
  return `Share link omits ${names} for length.`;
}
