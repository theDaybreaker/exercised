"use client";

/**
 * SupersetCard — glass card for a superset with bracketed visual grouping.
 *
 * OUTV-04: visually bracketed with a 1px --color-accent left border indicating the group.
 * UI-SPEC §7.3: "Superset · rest {N}s" header label (verbatim).
 * Each inner exercise is a stripped-down inline block (no outer glass — they're inside the superset's glass).
 */

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { RoutineItem } from "@/lib/schema/workout";

type Superset = Extract<RoutineItem, { type: "superset" }>;
type SupersetExercise = Superset["exercises"][number];

interface SupersetCardProps {
  superset: Superset;
  index: number;
  shouldAnimateIn: boolean;
}

interface InnerExerciseProps {
  exercise: SupersetExercise;
  prefersReducedMotion: boolean | null;
}

function InnerExercise({ exercise, prefersReducedMotion }: InnerExerciseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasFormCues = exercise.form_cues && exercise.form_cues.length > 0;

  return (
    <div className="py-3">
      {/* Inner exercise name */}
      <h3
        className="text-[18px] font-semibold"
        style={{
          color: "var(--color-text-primary)",
          lineHeight: "1.3",
          letterSpacing: "-0.01em",
        }}
      >
        {exercise.exercise_name}
      </h3>

      {/* Sets × reps — Geist Mono tabular-nums */}
      <p
        className="mt-1 font-mono tabular-nums text-sm font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        {exercise.sets} × {exercise.reps}
      </p>

      {/* Form cues expand toggle */}
      {hasFormCues && (
        <div className="mt-2">
          <button
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex min-h-[44px] items-center gap-2 text-sm font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <ChevronDown size={14} aria-hidden="true" />
            </motion.div>
            {isOpen
              ? "Hide form cues"
              : `Form cues (${exercise.form_cues.length})`}
          </button>

          <motion.div
            animate={{ height: isOpen ? "auto" : 0 }}
            initial={{ height: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
            }
            style={{ overflow: "hidden" }}
          >
            <ul className="mt-1 space-y-1">
              {exercise.form_cues.map((cue, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span aria-hidden="true" className="mt-1 text-xs">•</span>
                  {cue}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export function SupersetCard({ superset }: SupersetCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="glass-card card-hover-lift px-6 py-5">
      {/* Header — verbatim per UI-SPEC §7.3 */}
      <p
        className="mb-4 text-sm font-medium uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Superset · rest {superset.rest_seconds}s
      </p>

      {/* Bracketed left-border grouping (OUTV-04) */}
      <div
        className="space-y-0 divide-y divide-white/5 pl-4"
        style={{
          borderLeft: "2px solid rgba(124, 255, 107, 0.6)",
        }}
      >
        {superset.exercises.map((exercise, i) => (
          <InnerExercise
            key={i}
            exercise={exercise}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </div>
  );
}
