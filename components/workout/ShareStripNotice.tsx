"use client";

/**
 * ShareStripNotice — D-17 recipient-side notice rendered above the WorkoutHeader.
 *
 * UI-SPEC §11: If payload was stripped per D-17 (>2KB), render inline notice above
 * the workout header: 'Share link omits form cues for length.' in Label style,
 * --text-muted, with a small Info icon.
 *
 * Uses role="status" so screen readers announce the notice without interrupting.
 */

import { Info } from "lucide-react";
import type { StripField } from "@/lib/schema/workout";
import { noticeText } from "@/lib/share/notice";

interface ShareStripNoticeProps {
  strippedFields: StripField[];
}

export function ShareStripNotice({ strippedFields }: ShareStripNoticeProps) {
  const text = noticeText(strippedFields);
  if (!text) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 mx-auto max-w-3xl px-6 py-2 text-sm"
      style={{ color: "var(--color-text-muted, var(--color-text-secondary))" }}
    >
      <Info size={14} aria-hidden="true" className="shrink-0" />
      <span>{text}</span>
    </div>
  );
}
