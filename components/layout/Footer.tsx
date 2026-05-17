/**
 * Footer — RSC AI-disclaimer + project credit line.
 *
 * UI-SPEC §7.1 copy. OUTV-06 surface.
 * Wired into app/page.tsx. No "use client" needed — static markup.
 */
export function Footer() {
  return (
    <footer className="w-full py-6 px-6 text-center">
      <p
        className="text-sm leading-5"
        style={{ color: "var(--color-text-muted)" }}
      >
        AI-extracted from public video content. Verify form, reps, and rest in
        the source video before training.
      </p>
      {/* opacity removed — muted-text color alone passes WCAG 2AA at 9.1:1; opacity:0.6 blended to 3.8:1 (DSGN-06 fix) */}
      <p
        className="mt-1 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Exercised — a demo. v1.
      </p>
    </footer>
  );
}
