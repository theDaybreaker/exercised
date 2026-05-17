import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Footer } from "@/components/layout/Footer";

/**
 * HomePage — RSC shell for Phase 1.
 *
 * Plan 01-01 ships the ambient gradient background + footer chrome only.
 * Plan 01-02 inserts <ExtractFlow /> between the hero placeholder and footer.
 *
 * Layout per UI-SPEC §9.2 (single-screen centered composition, D-04).
 */
export default function HomePage() {
  return (
    <>
      <AmbientBackground />
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
          {/* Hero headline — Display size per UI-SPEC §3 */}
          <h1
            className="text-4xl font-semibold tracking-tight md:text-5xl"
            style={{
              color: "var(--color-text-primary)",
              lineHeight: "1.15",
              letterSpacing: "-0.02em",
            }}
          >
            Turn workout videos into structured routines.
          </h1>

          {/* Hero subhead — Body per UI-SPEC §7.1 */}
          <p
            className="max-w-lg text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Paste a YouTube workout URL. We extract the exercises, sets, reps,
            and form cues in seconds.
          </p>

          {/* Placeholder — Plan 01-02 replaces this with <ExtractFlow /> */}
          <div
            className="glass-card flex h-14 w-full items-center justify-center rounded-2xl px-6"
          >
            <span
              className="text-sm font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              Interactive UI coming in Plan 01-02
            </span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
