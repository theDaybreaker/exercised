"use client";

/**
 * ErrorState — Reusable error/empty/limit state card component.
 *
 * Handles 4 error variants per UI-SPEC §7.4:
 *   NETWORK:     "Something went wrong on our end."   → "Try again"
 *   NO_WORKOUT:  "No workout in this video."          → "Try another URL"
 *   RATE_LIMITED: "Slow down for a moment."           → "Got it"
 *   UNKNOWN:     "Something went wrong."              → "Try again"
 *
 * INVALID_URL is handled inline by UrlInput — NOT this component.
 *
 * Accessibility:
 *   - role="alert" on the card for screen reader announcement
 *   - Recovery button h-11 (44px) minimum touch target (OUTV-07, UI-SPEC §2)
 */

import { Button } from "@/components/ui/button";

type ErrorCode = "NETWORK" | "NO_WORKOUT" | "RATE_LIMITED" | "UNKNOWN";

interface ErrorStateProps {
  code: ErrorCode;
  message: string;
  onRecover: () => void;
}

const ERROR_CONFIG: Record<
  ErrorCode,
  { heading: string; body: string; cta: string }
> = {
  NETWORK: {
    heading: "Something went wrong on our end.",
    body: "We couldn't reach the extraction service. Check your connection and try again.",
    cta: "Try again",
  },
  NO_WORKOUT: {
    heading: "No workout in this video.",
    body: "We couldn't find an exercise routine in this video. Try a clearly-narrated workout video — like an instructor calling out sets, reps, and form cues.",
    cta: "Try another URL",
  },
  RATE_LIMITED: {
    heading: "Slow down for a moment.",
    body: "You've extracted a lot of workouts recently. Wait a minute and try again.",
    cta: "Got it",
  },
  UNKNOWN: {
    heading: "Something went wrong.",
    body: "", // body comes from the message prop for UNKNOWN
    cta: "Try again",
  },
};

export function ErrorState({ code, message, onRecover }: ErrorStateProps) {
  const config = ERROR_CONFIG[code];
  const body = code === "UNKNOWN" ? message : config.body;

  return (
    <div
      className="glass-card mx-auto max-w-2xl space-y-4 p-6 text-center"
      role="alert"
    >
      {/* Heading — Heading size (22px/600 per UI-SPEC §3) */}
      <h2
        className="text-[22px] font-semibold leading-snug tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {config.heading}
      </h2>

      {/* Body — Body size (16px/400 per UI-SPEC §3) */}
      <p
        className="text-base leading-relaxed"
        style={{ color: "var(--color-text-secondary, var(--color-text-primary))" }}
      >
        {body}
      </p>

      {/* Recovery CTA — h-11 = 44px minimum touch target (OUTV-07) */}
      <Button
        size="lg"
        className="h-11 px-8"
        onClick={onRecover}
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-bg-base)",
        }}
      >
        {config.cta}
      </Button>
    </div>
  );
}
