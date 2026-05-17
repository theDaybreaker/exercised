"use client";

/**
 * WorkoutView — renders the full workout result with Motion stagger cascade.
 *
 * UI-SPEC §6.2: header first, then exercise cards 65ms stagger (D-08 50-80ms range).
 * Spring: { damping: 22, stiffness: 240 } per UI-SPEC §6.2 settled-value.
 * D-05: useReducedMotion() — when true, instant cross-fade, no transform/stagger.
 * D-16: shouldAnimateIn=false (share-link hydration) → instant render, no cascade.
 */

import { motion, useReducedMotion } from "motion/react";
import type { Workout, StripField } from "@/lib/schema/workout";
import { WorkoutHeader } from "@/components/workout/WorkoutHeader";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { SupersetCard } from "@/components/workout/SupersetCard";
import { ActionBar } from "@/components/workout/ActionBar";
import { ShareStripNotice } from "@/components/workout/ShareStripNotice";

interface WorkoutViewProps {
  workout: Workout;
  shouldAnimateIn: boolean;
  /** D-17: when opening a stripped share link, pass the stripped fields to render the inline notice */
  shareLinkOmittedFields?: StripField[];
}

// Motion variants — UI-SPEC §6.2
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.065, // 65ms stagger per UI-SPEC §6.2
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      damping: 22,
      stiffness: 240,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      damping: 22,
      stiffness: 240,
    },
  },
};

// Reduced-motion variant — cross-fade over 200ms, no transform/stagger
const reducedMotionCardVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

export function WorkoutView({ workout, shouldAnimateIn, shareLinkOmittedFields }: WorkoutViewProps) {
  const prefersReducedMotion = useReducedMotion();

  // When no animation: Motion treats initial/animate=false as "no animation"
  const shouldAnimate = shouldAnimateIn && !prefersReducedMotion;
  const useReducedVariants = shouldAnimateIn && prefersReducedMotion;

  const initial = shouldAnimate ? "hidden" : useReducedVariants ? "hidden" : false;
  const animate = shouldAnimate ? "visible" : useReducedVariants ? "visible" : false;

  const effectiveHeaderVariants = useReducedVariants
    ? reducedMotionCardVariants
    : headerVariants;
  const effectiveCardVariants = useReducedVariants
    ? reducedMotionCardVariants
    : cardVariants;

  return (
    <motion.article
      className="mx-auto w-full max-w-3xl space-y-6 px-6 pb-24 pt-12 md:pb-16"
      variants={containerVariants}
      initial={initial}
      animate={animate}
    >
      {/* D-17 strip notice — above header when share link was stripped */}
      {shareLinkOmittedFields && shareLinkOmittedFields.length > 0 && (
        <ShareStripNotice strippedFields={shareLinkOmittedFields} />
      )}

      {/* Workout header — animates first */}
      <motion.div variants={effectiveHeaderVariants}>
        <WorkoutHeader workout={workout} />
      </motion.div>

      {/* ActionBar — above exercise list per UI-SPEC §9.4 */}
      <motion.div variants={effectiveCardVariants}>
        <ActionBar workout={workout} />
      </motion.div>

      {/* Exercise cards — staggered cascade (D-08) */}
      {workout.routine.map((item, i) => (
        <motion.div key={i} variants={effectiveCardVariants}>
          {item.type === "standard_set" ? (
            <ExerciseCard
              exercise={item}
              index={i}
              shouldAnimateIn={shouldAnimateIn}
            />
          ) : (
            <SupersetCard
              superset={item}
              index={i}
              shouldAnimateIn={shouldAnimateIn}
            />
          )}
        </motion.div>
      ))}
    </motion.article>
  );
}
