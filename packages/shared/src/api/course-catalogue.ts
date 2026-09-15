import { z } from "zod";
import { idSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { lessonContentTypeSchema, lessonClassificationSchema } from "./course-lessons.js";
import { courseProgressSummarySchema } from "./course-progress.js";
import { assessmentAttemptResultSchema } from "./assessment-attempts.js";
import { assessmentTypeSchema } from "./assessments.js";
import { departmentRefSchema } from "./departments.js";

/**
 * User-facing course catalogue/detail (SYSTEM_PLAN.md §26 `GET /courses`,
 * `GET /courses/:id`). Deliberately a smaller field set than the Admin
 * course/module/lesson DTOs (packages/shared/src/api/{courses,course-modules,
 * course-lessons}.ts) — no `status` (every result is implicitly PUBLISHED
 * by construction), no `created_by`/`archived_at`/completion-criteria
 * config, no `is_active` on modules/lessons (only active ones are ever
 * returned). See this unit's implementation report for the field-inclusion
 * reasoning, particularly for EXTERNAL_LINK/TEXT lessons.
 */

/** GET /api/v1/courses list item — a lighter shape than the Admin course summary. */
export const courseCatalogueItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_media_id: idSchema.nullable(),
  category: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  // Department visibility in the Trainer Portal UI unit: the department(s)
  // this course is assigned to (from `course_departments`, already the
  // authoritative access-control source `effectiveCourseAccessFilter` reads
  // — this is a read-only display of that same existing data, not a new
  // access-control input). An empty array means globally visible (no
  // department restriction configured), the same "empty mapping = global"
  // convention `course_departments` already uses everywhere else.
  departments: z.array(departmentRefSchema),
  // Phase 3: the caller's own course_progress (self-scoped — never another
  // user's). See course-progress.ts's doc comment for the NOT_STARTED
  // synthetic-projection convention this reuses.
  progress: courseProgressSummarySchema,
});
export type CourseCatalogueItem = z.infer<typeof courseCatalogueItemSchema>;

export const courseCatalogueListResponseSchema = apiPaginatedSchema(courseCatalogueItemSchema);
export type CourseCatalogueListResponse = z.infer<typeof courseCatalogueListResponseSchema>;

/** Page-size defaults mirror the already-established convention (Admin list endpoints). */
export const listCourseCatalogueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListCourseCatalogueQuery = z.infer<typeof listCourseCatalogueQuerySchema>;

/**
 * A lesson within course detail. `media_asset_id` is exposed as a plain
 * reference (never resolved to a URL — Media/Storage remain out of scope).
 * `external_url`/`text_content` ARE exposed: unlike VIDEO/PDF/DOCUMENT/
 * PRESENTATION (which will eventually need a signed-URL flow from the
 * future Media unit), EXTERNAL_LINK and TEXT have no other delivery
 * mechanism at all — the URL/text IS the lesson content, stored directly
 * (§14.2), so omitting it would make those two content types permanently
 * unusable rather than "not yet available."
 */
export const courseDetailLessonSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  content_type: lessonContentTypeSchema,
  media_asset_id: idSchema.nullable(),
  // Added by Phase 2I (PDF/DOCUMENT/PRESENTATION viewers): the media asset's
  // stored MIME type, needed client-side to distinguish DOCX (renderable via
  // mammoth) from legacy binary DOC (no safe client-side parser exists) —
  // both share content_type "DOCUMENT". Null for TEXT/EXTERNAL_LINK lessons
  // and for any media-backed lesson with no media attached yet.
  media_mime_type: z.string().nullable(),
  external_url: z.string().nullable(),
  text_content: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  sort_order: z.number().int(),
  is_required: z.boolean(),
  classification: lessonClassificationSchema,
});
export type CourseDetailLesson = z.infer<typeof courseDetailLessonSchema>;

/** A module within course detail — only active modules/lessons are ever included (server-filtered). */
export const courseDetailModuleSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  lessons: z.array(courseDetailLessonSchema),
});
export type CourseDetailModule = z.infer<typeof courseDetailModuleSchema>;

/**
 * Phase 4: a lightweight, PUBLISHED-only assessment summary embedded in
 * course detail — reuses this same endpoint rather than adding a redundant
 * "list assessments for course" route (mirrors how progress was embedded
 * here in Phase 3). `my_attempts_used`/`my_best_result` let the trainee UI
 * show attempt-budget/status without a second call per assessment.
 */
export const courseDetailAssessmentSchema = z.object({
  id: idSchema,
  title: z.string(),
  type: assessmentTypeSchema,
  total_marks: z.number().int(),
  passing_marks: z.number().int(),
  duration_minutes: z.number().int().nullable(),
  due_date: z.string().nullable(),
  max_attempts: z.number().int(),
  my_attempts_used: z.number().int(),
  my_best_result: assessmentAttemptResultSchema.nullable(),
});
export type CourseDetailAssessment = z.infer<typeof courseDetailAssessmentSchema>;

/** GET /api/v1/courses/:id. */
export const courseDetailSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_media_id: idSchema.nullable(),
  category: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  // Department visibility in the Trainer Portal UI unit — see
  // courseCatalogueItemSchema's identical field for the full rationale.
  departments: z.array(departmentRefSchema),
  progress: courseProgressSummarySchema,
  modules: z.array(courseDetailModuleSchema),
  assessments: z.array(courseDetailAssessmentSchema),
});
export type CourseDetail = z.infer<typeof courseDetailSchema>;

export const courseDetailResponseSchema = apiSuccessSchema(courseDetailSchema);
export type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
