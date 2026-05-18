// Source: RESEARCH Pattern 6, D-22 (CONTEXT.md), Pitfall 5
// Hallucination guard: drop exercises whose sourceQuote does not appear
// in the transcript (case-insensitive substring with whitespace normalization).
// Returns droppedCount for D-23d low-confidence banner trigger.
import type { Workout, RoutineItem } from "@/lib/schema/workout";

/**
 * Normalizes a string for case-insensitive substring matching.
 * Lowercases, collapses all whitespace runs to a single space, trims edges.
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Returns true if `quote` appears (case-insensitively, whitespace-normalized)
 * as a substring of `transcript`. Empty string always returns false.
 */
export function isSubstring(quote: string, transcript: string): boolean {
  if (!quote) return false;
  return normalize(transcript).includes(normalize(quote));
}

/**
 * Validates each exercise's sourceQuote against the transcript.
 *
 * Rules (D-22):
 *  - sourceQuote === null → exercise passes (null means "no quote provided")
 *  - sourceQuote is non-null AND fails isSubstring → exercise is DROPPED
 *  - droppedCount incremented for every dropped exercise
 *
 * Superset edge cases (RESEARCH Pattern 6):
 *  - 0 survivors → entire superset dropped (droppedCount += all exercises)
 *  - 1 survivor → promoted to standard_set (superset requires ≥2)
 *  - 2+ survivors → superset kept with filtered exercises
 *
 * @param workout - Validated Workout from LLM extraction
 * @param transcript - Raw caption text used for substring matching
 * @returns { workout, droppedCount } — droppedCount ≥ 1 triggers low-confidence banner (D-23d)
 */
export function validateSourceQuotes(
  workout: Workout,
  transcript: string,
): { workout: Workout; droppedCount: number } {
  let droppedCount = 0;

  const filteredRoutine = workout.routine.flatMap(
    (item: RoutineItem): RoutineItem[] => {
      if (item.type === "standard_set") {
        // Non-null sourceQuote that fails substring check → drop
        if (item.sourceQuote && !isSubstring(item.sourceQuote, transcript)) {
          droppedCount++;
          return [];
        }
        return [item];
      }

      // superset: filter inner exercises by the same rule
      const filteredExercises = item.exercises.filter((ex) => {
        if (ex.sourceQuote && !isSubstring(ex.sourceQuote, transcript)) {
          droppedCount++;
          return false;
        }
        return true;
      });

      if (filteredExercises.length === 0) {
        // All inner exercises dropped — drop entire superset
        return [];
      }

      if (filteredExercises.length === 1) {
        // Only 1 survivor — promote to standard_set (superset requires ≥2)
        return [{ ...filteredExercises[0], type: "standard_set" as const }];
      }

      // 2+ survivors — keep as superset with filtered inner exercises
      return [{ ...item, exercises: filteredExercises }];
    },
  );

  return {
    workout: { ...workout, routine: filteredRoutine },
    droppedCount,
  };
}
