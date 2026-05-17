/**
 * AmbientBackground — RSC fixed-position gradient orb container.
 *
 * Three drifting orbs (green/violet/coral) behind all content via CSS keyframe
 * animations defined in globals.css (.orb-1, .orb-2, .orb-3).
 *
 * Reduced motion: CSS @media block in globals.css sets animation: none on .orb-*.
 * No JS needed — no "use client" directive required.
 */
export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      {/* Orb 1 — primary green (the accent's faint echo) */}
      <div
        className="orb-1 absolute"
        style={{
          top: "-10%",
          left: "-15%",
          width: "60vw",
          height: "60vw",
          background:
            "radial-gradient(circle, rgba(124, 255, 107, 0.18) 0%, rgba(124, 255, 107, 0) 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Orb 2 — deep violet (complementary to green; carries cool depth) */}
      <div
        className="orb-2 absolute"
        style={{
          bottom: "-20%",
          right: "-20%",
          width: "70vw",
          height: "70vw",
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0) 70%)",
          filter: "blur(100px)",
        }}
      />

      {/* Orb 3 — warm coral (the third hot accent; sparse, low-opacity) */}
      <div
        className="orb-3 absolute"
        style={{
          top: "40%",
          left: "40%",
          width: "40vw",
          height: "40vw",
          background:
            "radial-gradient(circle, rgba(255, 138, 76, 0.14) 0%, rgba(255, 138, 76, 0) 65%)",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
