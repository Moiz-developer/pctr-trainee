import { z } from "zod";
import { idSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";
import { courseProgressStatusSchema } from "./course-progress.js";
import { announcementResponseSchema } from "./announcements.js";

/**
 * GET /api/v1/dashboard (SYSTEM_PLAN.md §26: "aggregates hours, progress,
 * announcements, continue-learning"; §40 Phase 3: "dashboard real data
 * (hours, progress, continue learning)"). `announcements` (Phase 5.3.6)
 * reuses `announcementResponseSchema` wholesale — the exact same shape
 * `GET /announcements` returns — rather than a second, parallel
 * dashboard-only announcement type. `popup_announcements` is the
 * `show_as_popup=true` + not-yet-dismissed subset (SYSTEM_PLAN.md §14.6's
 * own literal popup rule), embedded here so Portal-open popup logic reuses
 * this same `GET /dashboard` call instead of a second endpoint.
 */
export const dashboardHoursSchema = z.object({
  consumed_hours: z.number(),
  allocated_hours: z.number(),
});
export type DashboardHours = z.infer<typeof dashboardHoursSchema>;

export const dashboardCourseSummarySchema = z.object({
  total_courses: z.number().int(),
  not_started: z.number().int(),
  in_progress: z.number().int(),
  completed: z.number().int(),
});
export type DashboardCourseSummary = z.infer<typeof dashboardCourseSummarySchema>;

/**
 * The Trainer Portal Dashboard spec's own "Training Progress" section: one
 * Theoretical and one Practical percentage, not per-course (unlike
 * `continue_learning`'s per-course figures below, which remain unchanged).
 * Computed as a plain average of each accessible course's own
 * `course_progress.theoretical_progress_pct`/`practical_progress_pct`
 * (dashboard.service.ts) — the same averaging principle
 * course-progress.service.ts already uses for `overall_progress_pct`
 * (`(theoretical + practical) / 2`), just applied one level up across
 * courses rather than a newly-invented formula. A course with no
 * `course_progress` row yet counts as 0%, matching how such a course is
 * already counted as `not_started` in `dashboardCourseSummarySchema` above.
 */
export const dashboardTrainingProgressSchema = z.object({
  theoretical_progress_pct: z.number(),
  practical_progress_pct: z.number(),
});
export type DashboardTrainingProgress = z.infer<typeof dashboardTrainingProgressSchema>;

export const dashboardContinueLearningItemSchema = z.object({
  course_id: idSchema,
  course_title: z.string(),
  course_slug: z.string(),
  overall_progress_pct: z.number(),
  // The real per-course values already computed/persisted by
  // course-progress.service.ts's recompute logic (§14.3/§18) — exposed
  // here as-is, not recomputed. Per-course, matching how `course_progress`
  // itself is scoped, rather than an invented dashboard-wide aggregate.
  theoretical_progress_pct: z.number(),
  practical_progress_pct: z.number(),
  status: courseProgressStatusSchema,
  last_recalculated_at: z.string(),
});
export type DashboardContinueLearningItem = z.infer<typeof dashboardContinueLearningItemSchema>;

export const dashboardDataSchema = z.object({
  hours: dashboardHoursSchema,
  courses: dashboardCourseSummarySchema,
  training_progress: dashboardTrainingProgressSchema,
  continue_learning: z.array(dashboardContinueLearningItemSchema),
  announcements: z.array(announcementResponseSchema),
  popup_announcements: z.array(announcementResponseSchema),
});
export type DashboardData = z.infer<typeof dashboardDataSchema>;

export const dashboardResponseSchema = apiSuccessSchema(dashboardDataSchema);
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
