"use client";

/**
 * DifficultyChip — workout difficulty indicator.
 *
 * UI-SPEC §4.1 accent rules:
 * - beginner: --color-text-muted border + label
 * - intermediate / advanced: --color-accent border + label
 */

interface DifficultyChipProps {
  difficulty: "beginner" | "intermediate" | "advanced";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DifficultyChip({ difficulty }: DifficultyChipProps) {
  const isAccented = difficulty === "intermediate" || difficulty === "advanced";

  return (
    <span
      className="inline-flex items-center rounded-xl px-3 py-1 text-sm font-medium"
      style={{
        backgroundColor: isAccented
          ? "var(--color-accent-muted)"
          : "var(--color-surface-glass)",
        border: `1px solid ${isAccented ? "var(--color-accent)" : "var(--color-border-glass)"}`,
        color: isAccented
          ? "var(--color-accent)"
          : "var(--color-text-muted)",
      }}
    >
      {capitalize(difficulty)}
    </span>
  );
}
