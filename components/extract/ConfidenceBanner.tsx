"use client";

/**
 * ConfidenceBanner — Amber informational banner shown when extraction may be incomplete.
 *
 * D-23: Renders above WorkoutHeader when lowConfidence=true.
 * D-23e: Copy: "Heads up — this extraction may be incomplete. Skim the source video for anything we missed."
 * D-23f: Amber/yellow accent (NOT red — red is ErrorState territory); role="status" (informational,
 *        non-interrupting); dismissible via local state in WorkoutView.
 *
 * Accessibility:
 *   - role="status" — announced by screen readers as informational, not urgent (vs role="alert")
 *   - Dismiss button has aria-label for screen reader clarity
 */

interface ConfidenceBannerProps {
  onDismiss: () => void;
}

export function ConfidenceBanner({ onDismiss }: ConfidenceBannerProps) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
      style={{
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderColor: "rgba(245, 158, 11, 0.4)",
      }}
    >
      {/* Icon + message */}
      <div className="flex items-start gap-3">
        {/* Amber warning icon */}
        <span
          className="mt-0.5 shrink-0 text-lg leading-none"
          aria-hidden="true"
          style={{ color: "rgb(245, 158, 11)" }}
        >
          ⚠
        </span>

        <p
          className="text-sm leading-snug"
          style={{ color: "rgb(217, 119, 6)" }}
        >
          <strong>Heads up</strong> — this extraction may be incomplete. Skim
          the source video for anything we missed.
        </p>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss low-confidence warning"
        className="shrink-0 rounded-md p-1 transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2"
        style={{
          color: "rgb(245, 158, 11)",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ["--tw-ring-color" as any]: "rgba(245, 158, 11, 0.5)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
