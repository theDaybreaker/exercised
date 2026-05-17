import { z } from "zod";

// ─── Per-exercise common fields (locked schema for Phase 4 forward-compat) ───
const ExerciseCoreSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.string().min(1), // "10" | "8-12" | "AMRAP"
  rest_seconds: z.number().int().nonnegative(),
  form_cues: z.array(z.string()).default([]),
  startTimestamp: z.number().int().nonnegative().nullable(), // SCHM-03 — Phase 4 renders
  sourceQuote: z.string().nullable(), // SCHM-03 — Phase 4 renders
  equipment: z.array(z.string()).default([]), // SCHM-03 — Phase 4 renders
});

// ─── Routine entry types — discriminated union on `type` (SCHM-05) ───
const StandardSetSchema = ExerciseCoreSchema.extend({
  type: z.literal("standard_set"),
});

const SupersetSchema = z.object({
  type: z.literal("superset"),
  exercises: z.array(ExerciseCoreSchema).min(2),
  rest_seconds: z.number().int().nonnegative(),
});

export const RoutineItemSchema = z.discriminatedUnion("type", [
  StandardSetSchema,
  SupersetSchema,
]);

// ─── Workout — top-level (SCHM-02) ───
export const WorkoutSchema = z.object({
  schema_version: z.literal("1"), // SCHM-02 — D-18 versioning
  workout_title: z.string().min(1),
  creator_username: z.string().min(1),
  target_muscles: z.array(z.string()).default([]),
  estimated_duration_mins: z.number().int().positive(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]), // SCHM-04
  extraction_confidence: z.enum(["high", "medium", "low"]), // SCHM-02
  routine: z.array(RoutineItemSchema).min(1),
});

// ─── Wire contract for /api/extract ───
export const ExtractRequestSchema = z.object({
  url: z.string().url(),
});

export const ExtractEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stage"),
    stage: z.enum(["fetching", "transcribing", "analyzing", "generating"]),
  }),
  z.object({ type: z.literal("result"), workout: WorkoutSchema }),
  z.object({
    type: z.literal("error"),
    code: z.enum(["NETWORK", "NO_WORKOUT", "RATE_LIMITED", "UNKNOWN"]),
    message: z.string(),
  }),
]);

// ─── Inferred TypeScript types ───
export type Workout = z.infer<typeof WorkoutSchema>;
export type RoutineItem = z.infer<typeof RoutineItemSchema>;
export type ExtractEvent = z.infer<typeof ExtractEventSchema>;
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;
