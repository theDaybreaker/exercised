"use client";

/**
 * SkeletonCard — glass-card shimmer placeholder used during SSE streaming.
 *
 * Three internal shimmer rows (70% / 40% / 90% widths) with a sliding
 * linear-gradient overlay. The shimmer animation (.skeleton-shimmer) is
 * defined in globals.css and disabled under prefers-reduced-motion via the
 * @media block already in globals.css.
 */

export function SkeletonCard() {
  return (
    <div
      className="glass-card overflow-hidden px-6 py-5"
      aria-hidden="true"
    >
      {/* Row 1 — exercise name placeholder ~70% */}
      <div className="relative mb-3 h-5 overflow-hidden rounded-md" style={{ width: "70%", backgroundColor: "var(--color-surface-glass)" }}>
        <div
          className="skeleton-shimmer absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Row 2 — sets/reps line placeholder ~40% */}
      <div className="relative mb-3 h-4 overflow-hidden rounded-md" style={{ width: "40%", backgroundColor: "var(--color-surface-glass)" }}>
        <div
          className="skeleton-shimmer absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Row 3 — form cues placeholder ~90% */}
      <div className="relative h-4 overflow-hidden rounded-md" style={{ width: "90%", backgroundColor: "var(--color-surface-glass)" }}>
        <div
          className="skeleton-shimmer absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
