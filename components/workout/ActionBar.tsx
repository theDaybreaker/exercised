"use client";

/**
 * ActionBar — Watch / Copy MD / Copy Plain / Share Workout buttons.
 *
 * OUTV-05: "Watch on YouTube" with ExternalLink icon, target="_blank".
 * SHRE-01: "Copy as Markdown" → navigator.clipboard.writeText + toast.
 * SHRE-02: "Copy as Plain Text" → navigator.clipboard.writeText + toast.
 * SHRE-03: "Share Workout" → encodeShareUrl + clipboard + "Share link copied" toast.
 * OUTV-07: all buttons ≥ 44px height via size="lg".
 */

import { ExternalLink, Link2, Copy, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Workout } from "@/lib/schema/workout";
import { workoutToMarkdown } from "@/lib/clipboard/markdown";
import { workoutToPlainText } from "@/lib/clipboard/plaintext";
import { encodeShareUrl } from "@/lib/share/encode";

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
    const { encoded } = encodeShareUrl(workout);
    const url = `${window.location.origin}/?w=${encoded}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Watch on YouTube — OUTV-05 */}
      <a
        href={`https://youtube.com/@${workout.creator_username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
        style={{
          borderColor: "var(--color-border-glass)",
          color: "var(--color-text-primary)",
        }}
      >
        <ExternalLink size={16} aria-hidden="true" />
        Watch on YouTube
      </a>

      {/* Copy as Markdown — SHRE-01 */}
      <Button
        variant="outline"
        size="lg"
        onClick={handleCopyMarkdown}
        className="inline-flex h-11 items-center gap-2"
      >
        <AlignLeft size={16} aria-hidden="true" />
        Copy as Markdown
      </Button>

      {/* Copy as Plain Text — SHRE-02 */}
      <Button
        variant="outline"
        size="lg"
        onClick={handleCopyPlainText}
        className="inline-flex h-11 items-center gap-2"
      >
        <Copy size={16} aria-hidden="true" />
        Copy as Plain Text
      </Button>

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
        Share Workout
      </Button>
    </div>
  );
}
