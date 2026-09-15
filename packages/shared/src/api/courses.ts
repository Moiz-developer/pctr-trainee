import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { courseCategoryRefSchema } from "./course-categories.js";

export const courseStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

/**
 * POST /api/v1/admin/courses (SYSTEM_PLAN.md §14.2, permission
 * `course.create`). Fields match the `Course` model from Unit 2.1 exactly.
 * `slug` is client-supplied, not server-generated — same reasoning as
 * departments' `slug` (no slugification algorithm defined anywhere, no
 * convention to invent one from). `status` is not accepted on create — new
 * courses always start `DRAFT` (schema default), matching the department
 * create convention (state changes go through update/dedicated endpoints).
 * `thumbnail_media_id` is deliberately excluded here even though the column
 * exists: no media/upload endpoint exists yet in this repo, so there is no
 * legitimate way for a client to hold a valid id to send — see this unit's
 * implementation report. `created_by`/timestamps are never client input.
 * `category_id` replaces the original free-text `category` field (Admin
 * Navigation + Dynamic Course Categories unit) — references an admin-managed
 * `course_categories` row, existence/active-status validated server-side
 * (courses.service.ts), never trusted from the client.
 */
export const createCourseRequestSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  category_id: idSchema.nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  completion_require_all_lessons: z.boolean().optional(),
  completion_require_practical: z.boolean().optional(),
  completion_require_assessment_pass: z.boolean().optional(),
  completion_min_assessment_score_pct: z.number().int().min(0).max(100).nullable().optional(),
});
export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>;

/**
 * PATCH /api/v1/admin/courses/:id (permission `course.create` — see this
 * unit's implementation report for why the create permission is reused
 * rather than inventing a `course.update`/`course.manage` code the plan
 * never names). Partial update; `id`/`created_by`/timestamps are never
 * editable. `status` accepts only `DRAFT`/`PUBLISHED` here — `ARCHIVED` is
 * reachable only via the dedicated archive endpoint, since archiving also
 * stamps `archived_at` and this unit doesn't define un-archiving semantics.
 */
export const updateCourseRequestSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  category_id: idSchema.nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  completion_require_all_lessons: z.boolean().optional(),
  completion_require_practical: z.boolean().optional(),
  completion_require_assessment_pass: z.boolean().optional(),
  completion_min_assessment_score_pct: z.number().int().min(0).max(100).nullable().optional(),
});
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>;

/** Full detail response — GET /admin/courses/:id, and the create/update/archive results. */
export const courseResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_media_id: idSchema.nullable(),
  category: courseCategoryRefSchema.nullable(),
  duration_minutes: z.number().int().nullable(),
  status: courseStatusSchema,
  completion_require_all_lessons: z.boolean(),
  completion_require_practical: z.boolean(),
  completion_require_assessment_pass: z.boolean(),
  completion_min_assessment_score_pct: z.number().int().nullable(),
  created_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
  archived_at: isoDateStringSchema.nullable(),
});
export type CourseResponse = z.infer<typeof courseResponseSchema>;

/**
 * Summary shape for GET /admin/courses (SYSTEM_PLAN.md §33: "list endpoints
 * return summary DTOs; full detail... only on the detail endpoint").
 * Omits description/completion-criteria/created_by/archived_at — available
 * on the detail endpoint, not needed to render a course list/table.
 */
export const courseSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  category: courseCategoryRefSchema.nullable(),
  duration_minutes: z.number().int().nullable(),
  status: courseStatusSchema,
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type CourseSummary = z.infer<typeof courseSummarySchema>;

/** GET /api/v1/admin/courses: { data: CourseSummary[], meta: PaginationMeta }. */
export const courseListResponseSchema = apiPaginatedSchema(courseSummarySchema);
export type CourseListResponse = z.infer<typeof courseListResponseSchema>;

/**
 * GET /api/v1/admin/courses/progress-summary (Admin Dashboard real data
 * unit): a single real, server-computed aggregate — how many
 * `course_progress` rows (across every trainee) currently have
 * `status = IN_PROGRESS` — for the Admin Dashboard's "Courses In Progress"
 * stat card. No existing endpoint exposed `course_progress` admin-wide
 * (only per-trainee, via `GET /dashboard`), so this one small read-only
 * aggregate was genuinely needed; it reuses the existing `course.view`
 * permission and the existing `course_progress` table/model as-is, adding
 * no new business logic.
 */
export const courseProgressSummaryResponseSchema = apiSuccessSchema(
  z.object({ in_progress_count: z.number().int().nonnegative() }),
);
export type CourseProgressSummaryResponse = z.infer<typeof courseProgressSummaryResponseSchema>;

/**
 * GET /api/v1/admin/courses query params. SYSTEM_PLAN.md §26 names "status"
 * explicitly as basic admin-list filtering; department filtering is out of
 * scope for this unit (no course_departments API yet). Page-size defaults
 * mirror the department list endpoint's already-established convention.
 */
export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: courseStatusSchema.optional(),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
