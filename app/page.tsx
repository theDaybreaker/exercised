import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Footer } from "@/components/layout/Footer";
import { ExtractFlow } from "@/components/extract/ExtractFlow";

/**
 * HomePage — RSC shell.
 *
 * Layout per UI-SPEC §9.2 (single-screen centered composition, D-04).
 * <ExtractFlow /> is the single Client island owning the FSM + SSE loop.
 * <AmbientBackground /> and <Footer /> are RSCs (zero client JS).
 */
export default function HomePage() {
  return (
    <>
      <AmbientBackground />
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
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

          {/* ExtractFlow — single Client island, owns all interactivity */}
          <div className="w-full">
            <ExtractFlow />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
