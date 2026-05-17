"use client";

/**
 * MusclePill — small chip for target muscle labels.
 *
 * UI-SPEC §4.1: glass surface background, 1px glass border, 12px border-radius,
 * Label-size type (14px/500), --color-text-primary label.
 */

interface MusclePillProps {
  muscle: string;
}

export function MusclePill({ muscle }: MusclePillProps) {
  return (
    <span
      className="inline-flex items-center rounded-xl px-3 py-1 text-sm font-medium"
      style={{
        backgroundColor: "var(--color-surface-glass)",
        border: "1px solid var(--color-border-glass)",
        color: "var(--color-text-primary)",
      }}
    >
      {muscle}
    </span>
  );
}
