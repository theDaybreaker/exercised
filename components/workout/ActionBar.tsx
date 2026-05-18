"use client";

/**
 * ActionBar — Watch / Copy MD / Copy Plain / Share Workout buttons.
 *
 * OUTV-05: "Watch on YouTube" with ExternalLink icon, target="_blank".
 * SHRE-01: "Copy as Markdown" → navigator.clipboard.writeText + toast.
 * SHRE-02: "Copy as Plain Text" → navigator.clipboard.writeText + toast.
 * SHRE-03: "Share Workout" → encodeShareUrl + clipboard + "Share link copied" toast.
 * OUTV-07: all buttons ≥ 44px height via h-11 (44px).
 *
 * Mobile (< md): fixed-bottom glass bar with safe-area-inset-bottom padding.
 * Desktop (≥ md): relative inline right-aligned layout.
 * Tooltips on Copy buttons: desktop-only via hidden md:block on TooltipContent.
 */

import { ExternalLink, Link2, Copy, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Workout } from "@/lib/schema/workout";
import { workoutToMarkdown } from "@/lib/clipboard/markdown";
import { workoutToPlainText } from "@/lib/clipboard/plaintext";
import { encodeShareUrl } from "@/lib/share/encode";
import { noticeText } from "@/lib/share/notice";

interface ActionBarProps {
  workout: Workout;
}

export function ActionBar({ workout }: ActionBarProps) {
  async function handleCopyMarkdown() {
    const md = workoutToMarkdown(workout);
    await navigator.clipboard.writeText(md);
    toast.success("Copied to clipboard");
  }

  async function handleCopyPlainText() {
    const text = workoutToPlainText(workout);
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function handleShare() {
    const { encoded, stripped } = encodeShareUrl(workout);
    const url = `${window.location.origin}/?w=${encoded}`;
    await navigator.clipboard.writeText(url);
    const notice = noticeText(stripped);
    if (notice) {
      toast.success("Share link copied", {
        description: notice,
      });
    } else {
      toast.success("Share link copied");
    }
  }

  return (
    <TooltipProvider>
      {/*
       * Mobile (<md): fixed bottom-0, glass-styled, safe-area-inset-bottom padding.
       * Desktop (≥md): relative inline, right-aligned, transparent background.
       * OUTV-07: all buttons ≥ 44px via h-11.
       */}
      <div
        className={[
          /* Mobile sticky-bottom glass bar */
          "fixed bottom-0 left-0 right-0 z-30",
          "bg-[var(--color-surface-glass)] backdrop-blur-xl",
          "border-t border-white/10",
          "pb-[env(safe-area-inset-bottom)] px-6 py-3",
          "flex gap-3 justify-around",
          /* Desktop: revert to inline right-aligned */
          "md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto",
          "md:bg-transparent md:backdrop-blur-none md:border-0",
          "md:pb-0 md:px-0 md:py-0",
          "md:justify-end md:mt-6",
        ].join(" ")}
      >
        {/* Watch on YouTube — OUTV-05, D-25d: prefer video_url over @creator channel link */}
        <a
          href={workout.video_url ?? `https://youtube.com/@${workout.creator_username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
          style={{
            borderColor: "var(--color-border-glass)",
            color: "var(--color-text-primary)",
          }}
        >
          <ExternalLink size={16} aria-hidden="true" />
          {/* Short label on mobile, full label on desktop */}
          <span className="md:hidden">Watch</span>
          <span className="hidden md:inline">Watch on YouTube</span>
        </a>

        {/* Copy as Markdown — SHRE-01 */}
        <Tooltip>
          {/*
           * base-ui Tooltip.Trigger renders as <button> by default.
           * We forward styling via className rather than using asChild.
           * OUTV-07: h-11 = 44px minimum touch target.
           */}
          <TooltipTrigger
            className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={handleCopyMarkdown}
            aria-label="Copy as Markdown"
          >
            <AlignLeft size={16} aria-hidden="true" />
            {/* Short label on mobile, full label on desktop — OUTV-07 */}
            <span className="md:hidden">Copy MD</span>
            <span className="hidden md:inline">Copy as Markdown</span>
          </TooltipTrigger>
          {/* Tooltip hidden on mobile (no hover anyway); text labels carry meaning */}
          <TooltipContent className="hidden md:inline-flex">
            Copy a markdown representation of this workout
          </TooltipContent>
        </Tooltip>

        {/* Copy as Plain Text — SHRE-02 */}
        <Tooltip>
          {/*
           * base-ui Tooltip.Trigger renders as <button> by default.
           * OUTV-07: h-11 = 44px minimum touch target.
           */}
          <TooltipTrigger
            className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={handleCopyPlainText}
            aria-label="Copy as Plain Text"
          >
            <Copy size={16} aria-hidden="true" />
            {/* Short label on mobile, full label on desktop — OUTV-07 */}
            <span className="md:hidden">Copy</span>
            <span className="hidden md:inline">Copy as Plain Text</span>
          </TooltipTrigger>
          {/* Tooltip hidden on mobile (no hover anyway); text labels carry meaning */}
          <TooltipContent className="hidden md:inline-flex">
            Copy a plain-text version (no markdown syntax) for Notes / WhatsApp
          </TooltipContent>
        </Tooltip>

        {/* Share Workout — SHRE-03 */}
        <Button
          variant="default"
          size="lg"
          onClick={handleShare}
          className="inline-flex h-11 items-center gap-2"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-bg-base)",
          }}
        >
          <Link2 size={16} aria-hidden="true" />
          <span className="md:hidden">Share</span>
          <span className="hidden md:inline">Share Workout</span>
        </Button>
      </div>
    </TooltipProvider>
  );
}
