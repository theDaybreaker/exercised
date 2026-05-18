/**
 * /about — Static informational page (RSC, no "use client")
 *
 * D-24: Three sections — What this is, AI accuracy, DMCA / takedowns.
 * D-24a: Single standalone page at /about. Linked from footer.
 * D-24b: Plain-language tone (not formal legalese for v1).
 * D-24c: DMCA contact email from ALERT_EMAIL env var or hello@exercised.app fallback.
 * D-24d: ALERT_EMAIL must be set to a reachable address before shipping to production.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Exercised",
  description:
    "Terms, AI accuracy, and DMCA contact for Exercised.",
};

const contactEmail =
  process.env.ALERT_EMAIL ?? "hello@exercised.app";

export default function AboutPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-6 py-16 md:py-24"
      style={{ color: "var(--color-text-primary)" }}
    >
      {/* Back link */}
      <nav className="mb-10">
        <Link
          href="/"
          className="text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
        >
          ← Back to Exercised
        </Link>
      </nav>

      {/* Page heading */}
      <h1
        className="text-[32px] font-semibold md:text-[40px] mb-10"
        style={{ letterSpacing: "-0.02em", lineHeight: "1.15" }}
      >
        About
      </h1>

      <div className="space-y-8">
        {/* Section 1: What this is */}
        <section className="glass-card px-6 py-6 lg:px-8">
          <h2
            className="text-xl font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            What this is
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Exercised extracts workout routines from public YouTube videos using
            AI. We don&apos;t host, store, or redistribute the source videos.
            You paste a YouTube URL — we read it, extract the exercises, and
            show you the routine. That&apos;s it.
          </p>
        </section>

        {/* Section 2: AI accuracy */}
        <section className="glass-card px-6 py-6 lg:px-8">
          <h2
            className="text-xl font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            AI accuracy
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Extractions are AI-generated and may be incomplete or wrong. The AI
            reads video captions and converts them into structured exercise
            data. It can miss exercises, misread reps, or hallucinate form
            cues. Always verify form and reps against the source video before
            training. If you see a banner on a result, that means we detected
            low confidence — treat that extraction with extra caution.
          </p>
        </section>

        {/* Section 3: DMCA / takedowns */}
        <section className="glass-card px-6 py-6 lg:px-8">
          <h2
            className="text-xl font-semibold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            DMCA / takedowns
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            If you&apos;re a creator and want a video&apos;s extraction blocked
            or removed, email us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium hover:opacity-80 transition-opacity"
              style={{ color: "var(--color-accent)" }}
            >
              {contactEmail}
            </a>{" "}
            with the YouTube URL. We respond within 7 business days.
          </p>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)", opacity: 0.75 }}
          >
            We only process publicly available YouTube videos. We do not store
            video content, audio, or personal data.
          </p>
        </section>
      </div>

      {/* Footer note */}
      <p
        className="mt-12 text-sm text-center"
        style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
      >
        Exercised — a demo. v1.
      </p>
    </main>
  );
}
