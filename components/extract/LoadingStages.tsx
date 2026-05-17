"use client";

/**
 * LoadingStages — SSE-driven 4-stage loading indicator.
 *
 * D-09: single active stage label with pulse-dot indicator, previous-stage
 *       checkmarks, upcoming stages with hollow dots.
 * D-10: UI consumes real SSE events, never timers.
 * UI-SPEC §7.2: verbatim stage labels (sentence case, trailing ellipsis when active).
 * UI-SPEC §14: aria-live="polite" for SR announcement of stage transitions.
 */

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { SkeletonCard } from "@/components/workout/SkeletonCard";
import type { Stage } from "@/components/extract/reducer";
import { STAGE_ORDER } from "@/components/extract/reducer";

// Verbatim stage labels per UI-SPEC §7.2 / CONTEXT.md D-06
const STAGE_LABELS: Record<Stage, { active: string; completed: string }> = {
  fetching: {
    active: "Fetching video data…",
    completed: "Fetching video data",
  },
  transcribing: {
    active: "Transcribing audio…",
    completed: "Transcribing audio",
  },
  analyzing: {
    active: "Analyzing form cues…",
    completed: "Analyzing form cues",
  },
  generating: {
    active: "Generating routine…",
    completed: "Generating routine",
  },
};

interface LoadingStagesProps {
  currentStage: Stage;
  completedStages: ReadonlyArray<Stage>;
}

export function LoadingStages({
  currentStage,
  completedStages,
}: LoadingStagesProps) {
  return (
    <div className="w-full max-w-2xl space-y-8">
      {/* Title — UI-SPEC §7.2 */}
      <h2
        className="text-center text-2xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}
      >
        Building your workout
      </h2>

      {/* Stage list */}
      <div className="space-y-4">
        {STAGE_ORDER.map((stage) => {
          const isCompleted = completedStages.includes(stage);
          const isActive = stage === currentStage;
          const isUpcoming = !isCompleted && !isActive;

          return (
            <div key={stage} className="flex items-center gap-3">
              {/* Stage indicator dot / checkmark */}
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{
                        duration: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Check
                        size={16}
                        style={{ color: "var(--color-accent)", opacity: 0.6 }}
                        aria-hidden="true"
                      />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      key="pulse"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{
                        duration: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="pulse-dot h-2 w-2 rounded-full"
                      style={{ backgroundColor: "var(--color-accent)" }}
                    />
                  ) : (
                    <motion.div
                      key="hollow"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-2 w-2 rounded-full"
                      style={{
                        border: "1px solid var(--color-accent)",
                        backgroundColor: "transparent",
                        opacity: 0.4,
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Stage label with aria-live for SR announcements */}
              <AnimatePresence mode="wait">
                {isActive ? (
                  <motion.div
                    key={`active-${stage}`}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {STAGE_LABELS[stage].active}
                  </motion.div>
                ) : isCompleted ? (
                  <motion.div
                    key={`completed-${stage}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {STAGE_LABELS[stage].completed}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`upcoming-${stage}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isUpcoming ? 0.4 : 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {STAGE_LABELS[stage].active}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* 4 skeleton workout cards visible below the stage list (PIPE-05) */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
