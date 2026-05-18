"use client";

/**
 * WorkoutHeader — top glass card with title, creator, duration, difficulty, muscle pills.
 *
 * UI-SPEC §8.2/8.3/9.4:
 * - workout_title: Display size (36px mobile / 48px desktop), weight 600, letter-spacing -0.02em
 * - "by @creator_username": muted Label below title
 * - DurationChip + DifficultyChip + MusclePills in a flex-wrap row
 * D-26d: renders "⚡ Cached" badge when cached=true (informational chip)
 */

import { Zap } from "lucide-react";
import type { Workout } from "@/lib/schema/workout";
import { DurationChip } from "@/components/workout/DurationChip";
import { DifficultyChip } from "@/components/workout/DifficultyChip";
import { MusclePill } from "@/components/workout/MusclePill";

interface WorkoutHeaderProps {
  workout: Workout;
  /** D-26d: show "⚡ Cached" badge when the result was served from cache */
  cached?: boolean;
}

export function WorkoutHeader({ workout, cached = false }: WorkoutHeaderProps) {
  return (
    <div className="glass-card px-6 py-6 lg:px-8 lg:py-8">
      {/* Title row with optional Cached badge */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        {/* D-26d: Cached badge — informational chip, subtle accent styling */}
        {cached && (
          <span
            className="mt-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: "rgba(var(--color-accent-rgb, 124, 58, 237), 0.15)",
              color: "var(--color-accent)",
              border: "1px solid rgba(var(--color-accent-rgb, 124, 58, 237), 0.3)",
            }}
            title="This extraction was served from cache"
          >
            <Zap className="h-3 w-3" aria-hidden="true" />
            Cached
          </span>
        )}
      </div>

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
