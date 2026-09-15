import { z } from "zod";

/**
 * The derived `course_progress` aggregate (SYSTEM_PLAN.md §14.3/§18) —
 * recomputed server-side by progress.service.ts's recomputeCourseProgress()
 * on every relevant `lesson_progress` write, inside the same DB transaction
 * as that write. Never written directly by any client request.
 */
export const courseProgressStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
export type CourseProgressStatus = z.infer<typeof courseProgressStatusSchema>;

/**
 * Embedded into the user-facing course catalogue/detail responses
 * (course-catalogue.ts) and the dashboard's continue-learning list
 * (dashboard.ts). A course the caller has never touched has no
 * `course_progress` row yet — this mirrors `lesson_progress`'s own synthetic
 * NOT_STARTED projection (lesson-progress.ts) rather than being nullable:
 * every course the catalogue/dashboard returns always has SOME progress
 * state to show, even if it's "not started."
 */
export const courseProgressSummarySchema = z.object({
  status: courseProgressStatusSchema,
  theoretical_progress_pct: z.number(),
  practical_progress_pct: z.number(),
  overall_progress_pct: z.number(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  last_recalculated_at: z.string().nullable(),
});
export type CourseProgressSummary = z.infer<typeof courseProgressSummarySchema>;
