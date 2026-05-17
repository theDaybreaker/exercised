"use client";

/**
 * DurationChip — estimated workout duration chip.
 *
 * Lucide Clock icon + "~{N} min" label in Geist Sans Label-size.
 */

import { Clock } from "lucide-react";

interface DurationChipProps {
  minutes: number;
}

export function DurationChip({ minutes }: DurationChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-sm font-medium"
      style={{
        backgroundColor: "var(--color-surface-glass)",
        border: "1px solid var(--color-border-glass)",
        color: "var(--color-text-muted)",
      }}
    >
      <Clock size={14} aria-hidden="true" />
      ~{minutes} min
    </span>
  );
}
