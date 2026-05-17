"use client";

/**
 * WorkoutHeader — top glass card with title, creator, duration, difficulty, muscle pills.
 *
 * UI-SPEC §8.2/8.3/9.4:
 * - workout_title: Display size (36px mobile / 48px desktop), weight 600, letter-spacing -0.02em
 * - "by @creator_username": muted Label below title
 * - DurationChip + DifficultyChip + MusclePills in a flex-wrap row
 */

import type { Workout } from "@/lib/schema/workout";
import { DurationChip } from "@/components/workout/DurationChip";
import { DifficultyChip } from "@/components/workout/DifficultyChip";
import { MusclePill } from "@/components/workout/MusclePill";

interface WorkoutHeaderProps {
  workout: Workout;
}

export function WorkoutHeader({ workout }: WorkoutHeaderProps) {
  return (
    <div className="glass-card px-6 py-6 lg:px-8 lg:py-8">
      {/* Workout title — Display size */}
      <h1
        className="text-[36px] font-semibold md:text-[48px]"
        style={{
          color: "var(--color-text-primary)",
          lineHeight: "1.15",
          letterSpacing: "-0.02em",
        }}
      >
        {workout.workout_title}
      </h1>

      {/* Creator handle */}
      <p
        className="mt-2 text-sm font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        by @{workout.creator_username}
      </p>

      {/* Chips + pills */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DurationChip minutes={workout.estimated_duration_mins} />
        <DifficultyChip difficulty={workout.difficulty} />
        {workout.target_muscles.map((muscle) => (
          <MusclePill key={muscle} muscle={muscle} />
        ))}
      </div>
    </div>
  );
}
