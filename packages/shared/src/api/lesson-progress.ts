import { z } from "zod";
import { idSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";

/**
 * Lesson Progress API (SYSTEM_PLAN.md §26 `PATCH /progress/lessons/:id`,
 * §18 "drives resume + completion recompute"). Only `lesson_progress`
 * (Phase 2C's persisted source of truth) is exposed here — `course_progress`
 * (the derived, recomputed aggregate cache over lesson_progress +
 * assessment_attempts, §14.3/§18) is out of scope until assessments exist;
 * see this unit's implementation report.
 */

export const lessonProgressStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
export type LessonProgressStatus = z.infer<typeof lessonProgressStatusSchema>;

/**
 * GET/PATCH .../progress/lessons/:id response shape. `id` is nullable
 * because a lesson the caller has never touched has no `lesson_progress`
 * row yet — GET returns a synthetic NOT_STARTED projection rather than 404,
 * since "no progress recorded yet" is this resource's normal empty state
 * (the player always needs a progress object to consult on load, per §18),
 * not a data-integrity error.
 */
export const lessonProgressResponseSchema = z.object({
  id: idSchema.nullable(),
  lesson_id: idSchema,
  status: lessonProgressStatusSchema,
  video_position_seconds: z.number().int().nonnegative(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
export type LessonProgressResponse = z.infer<typeof lessonProgressResponseSchema>;

export const lessonProgressDetailResponseSchema = apiSuccessSchema(lessonProgressResponseSchema);
export type LessonProgressDetailResponse = z.infer<typeof lessonProgressDetailResponseSchema>;

/**
 * PATCH body. `status` only accepts `IN_PROGRESS`/`COMPLETED` — `NOT_STARTED`
 * is never a client-supplied target state, only the absence of a row; the
 * server derives it, it isn't PATCHed into. An empty body is valid and means
 * "touch this lesson" — the server-side "start" action (§18: first write
 * sets `started_at`) — so every field is optional; there is no separate
 * `/start` endpoint, matching SYSTEM_PLAN.md's single documented endpoint.
 */
export const updateLessonProgressRequestSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
  video_position_seconds: z.number().int().nonnegative().optional(),
});
export type UpdateLessonProgressRequest = z.infer<typeof updateLessonProgressRequestSchema>;
