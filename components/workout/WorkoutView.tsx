"use client";

/**
 * WorkoutView — renders the full workout result.
 *
 * Implemented in Task 3. This is the stub placeholder that the build needs.
 * The full implementation with Motion stagger cascade, WorkoutHeader,
 * ExerciseCard, SupersetCard, and ActionBar is in Task 3.
 */

import type { Workout } from "@/lib/schema/workout";

interface WorkoutViewProps {
  workout: Workout;
  shouldAnimateIn: boolean;
}

export function WorkoutView({ workout }: WorkoutViewProps) {
  // Stub — replaced with full implementation in Task 3
  return (
    <div className="w-full max-w-3xl mx-auto px-6">
      <p style={{ color: "var(--color-text-muted)" }}>
        Workout: {workout.workout_title}
      </p>
    </div>
  );
}
