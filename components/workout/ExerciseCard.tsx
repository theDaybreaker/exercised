"use client";

/**
 * ExerciseCard — glass card for a single standard_set exercise.
 *
 * UI-SPEC §6.4: form-cue expand toggle with Motion animate height + ChevronDown rotation.
 * UI-SPEC §8.3: exercise_name in Heading size (22px/600), sets/reps/rest in Geist Mono.
 * OUTV-03: Geist Mono tabular-nums for "3 × 12 @ 60s rest".
 * D-05: useReducedMotion() disables transition, makes toggle instant.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { RoutineItem } from "@/lib/schema/workout";

type StandardSet = Extract<RoutineItem, { type: "standard_set" }>;

interface ExerciseCardProps {
  exercise: StandardSet;
  index: number;
  shouldAnimateIn: boolean;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const hasFormCues = exercise.form_cues && exercise.form_cues.length > 0;

  return (
    <div className="glass-card card-hover-lift px-6 py-5">
      {/* Exercise name — Heading size */}
      <h2
        className="text-[22px] font-semibold"
        style={{
          color: "var(--color-text-primary)",
          lineHeight: "1.3",
          letterSpacing: "-0.01em",
        }}
      >
        {exercise.exercise_name}
      </h2>

      {/* Sets × reps @ rest — Geist Mono tabular-nums */}
      <p
        className="mt-2 font-mono tabular-nums text-base font-medium"
        style={{ color: "var(--color-text-primary)" }}
      >
        {exercise.sets} × {exercise.reps} @ {exercise.rest_seconds}s rest
      </p>

      {/* Form cues expand toggle */}
      {hasFormCues && (
        <div className="mt-3">
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
                  : {
                      duration: 0.2,
                      ease: [0.22, 1, 0.36, 1],
                    }
              }
            >
              <ChevronDown size={16} aria-hidden="true" />
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
                : {
                    duration: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
            style={{ overflow: "hidden" }}
          >
            <ul className="mt-2 space-y-2">
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
