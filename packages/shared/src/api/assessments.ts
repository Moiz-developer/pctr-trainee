import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * Admin CRUD for the Assessment Engine (SYSTEM_PLAN.md §14.4/§19,
 * permission `assessment.manage` — not a code named in the plan's text; see
 * apps/api/src/db/seed.ts's doc comment). Mirrors the course-modules.ts /
 * course-lessons.ts nested-resource shape exactly: assessments nested under
 * courses, questions nested under assessments, options nested under
 * questions — no separate top-level REST resource, no delete endpoint
 * anywhere (this project's "no hard deletes" convention — `status` is the
 * assessment's own retirement mechanism, `ARCHIVED`).
 */

export const assessmentTypeSchema = z.enum(["QUIZ", "MOCK_EXAM", "PRACTICAL", "TEST", "OTHER"]);
export type AssessmentType = z.infer<typeof assessmentTypeSchema>;

export const assessmentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

export const assessmentQuestionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "PRACTICAL_MANUAL",
]);
export type AssessmentQuestionType = z.infer<typeof assessmentQuestionTypeSchema>;

/**
 * POST /api/v1/admin/courses/:courseId/assessments. `passing_marks` must not
 * exceed `total_marks` — the one cross-field rule §14.4 implies ("passing
 * marks" only makes sense as a fraction of the total). `status` is not
 * accepted on create — new assessments always start `DRAFT`, matching the
 * Course create convention (publish is a separate, explicit PATCH).
 */
export const createAssessmentRequestSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).nullable().optional(),
    type: assessmentTypeSchema,
    total_marks: z.number().int().positive(),
    passing_marks: z.number().int().nonnegative(),
    duration_minutes: z.number().int().positive().nullable().optional(),
    due_date: isoDateStringSchema.nullable().optional(),
    max_attempts: z.number().int().positive().optional(),
    // Optional cover image: a `course-media` media asset id (uploaded first via
    // POST /media/upload-url + /media/confirm, purpose `course-media`) — same
    // shape as course-modules.ts's own image_media_id field.
    image_media_id: idSchema.nullable().optional(),
  })
  .refine((data) => data.passing_marks <= data.total_marks, {
    message: "passing_marks must not exceed total_marks.",
    path: ["passing_marks"],
  });
export type CreateAssessmentRequest = z.infer<typeof createAssessmentRequestSchema>;

/**
 * PATCH .../assessments/:id. Partial update, including `status` transitions
 * (DRAFT/PUBLISHED/ARCHIVED — no separate archive endpoint, unlike courses;
 * nothing in SYSTEM_PLAN.md calls for one here). Cross-field
 * passing_marks<=total_marks is re-validated in the API service layer
 * against the merged state (a partial payload may omit either field).
 */
export const updateAssessmentRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  type: assessmentTypeSchema.optional(),
  total_marks: z.number().int().positive().optional(),
  passing_marks: z.number().int().nonnegative().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  due_date: isoDateStringSchema.nullable().optional(),
  max_attempts: z.number().int().positive().optional(),
  status: assessmentStatusSchema.optional(),
  // Omit to keep the current image, an id to replace it, `null` to remove it.
  image_media_id: idSchema.nullable().optional(),
});
export type UpdateAssessmentRequest = z.infer<typeof updateAssessmentRequestSchema>;

/** Admin response shape — mirrors §14.4's columns exactly, including `status`/full config (unlike the trainee-facing, sanitized shape in assessment-attempts.ts). */
export const assessmentResponseSchema = z.object({
  id: idSchema,
  course_id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  type: assessmentTypeSchema,
  total_marks: z.number().int(),
  passing_marks: z.number().int(),
  duration_minutes: z.number().int().nullable(),
  due_date: z.string().nullable(),
  max_attempts: z.number().int(),
  status: assessmentStatusSchema,
  image_media_id: idSchema.nullable(),
  created_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;

export const assessmentListResponseSchema = apiPaginatedSchema(assessmentResponseSchema);
export type AssessmentListResponse = z.infer<typeof assessmentListResponseSchema>;

export const listAssessmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;

/**
 * POST .../assessments/:assessmentId/questions. `question_text`/`marks`/
 * `sort_order` required, matching the lesson-authoring convention. Options
 * are managed via their own nested endpoint (.../questions/:id/options), not
 * embedded here — same separate-CRUD-resource shape as modules/lessons.
 */
export const createAssessmentQuestionRequestSchema = z.object({
  question_text: z.string().min(1),
  question_type: assessmentQuestionTypeSchema,
  marks: z.number().int().positive(),
  sort_order: z.number().int(),
});
export type CreateAssessmentQuestionRequest = z.infer<typeof createAssessmentQuestionRequestSchema>;

export const updateAssessmentQuestionRequestSchema = z.object({
  question_text: z.string().min(1).optional(),
  question_type: assessmentQuestionTypeSchema.optional(),
  marks: z.number().int().positive().optional(),
  sort_order: z.number().int().optional(),
});
export type UpdateAssessmentQuestionRequest = z.infer<typeof updateAssessmentQuestionRequestSchema>;

/** Admin question response — includes `is_correct` on options (the admin authoring view; the trainee-facing shape in assessment-attempts.ts strips it, per §19). */
export const assessmentQuestionOptionResponseSchema = z.object({
  id: idSchema,
  question_id: idSchema,
  option_text: z.string(),
  is_correct: z.boolean(),
  sort_order: z.number().int(),
});
export type AssessmentQuestionOptionResponse = z.infer<
  typeof assessmentQuestionOptionResponseSchema
>;

export const assessmentQuestionResponseSchema = z.object({
  id: idSchema,
  assessment_id: idSchema,
  question_text: z.string(),
  question_type: assessmentQuestionTypeSchema,
  marks: z.number().int(),
  sort_order: z.number().int(),
  created_at: isoDateStringSchema,
  options: z.array(assessmentQuestionOptionResponseSchema),
});
export type AssessmentQuestionResponse = z.infer<typeof assessmentQuestionResponseSchema>;

export const assessmentQuestionListResponseSchema = apiPaginatedSchema(
  assessmentQuestionResponseSchema,
);
export type AssessmentQuestionListResponse = z.infer<typeof assessmentQuestionListResponseSchema>;

export const listAssessmentQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAssessmentQuestionsQuery = z.infer<typeof listAssessmentQuestionsQuerySchema>;

/**
 * POST .../questions/:questionId/options. Rejected server-side (not at this
 * Zod layer, which has no access to the parent question's type) when the
 * parent question is SHORT_ANSWER/PRACTICAL_MANUAL (§14.4: "Not used for"
 * those types) — see assessment-question-options.service.ts.
 */
export const createAssessmentQuestionOptionRequestSchema = z.object({
  option_text: z.string().min(1),
  is_correct: z.boolean().optional(),
  sort_order: z.number().int(),
});
export type CreateAssessmentQuestionOptionRequest = z.infer<
  typeof createAssessmentQuestionOptionRequestSchema
>;

export const updateAssessmentQuestionOptionRequestSchema = z.object({
  option_text: z.string().min(1).optional(),
  is_correct: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export type UpdateAssessmentQuestionOptionRequest = z.infer<
  typeof updateAssessmentQuestionOptionRequestSchema
>;

export const assessmentQuestionOptionListResponseSchema = apiPaginatedSchema(
  assessmentQuestionOptionResponseSchema,
);
export type AssessmentQuestionOptionListResponse = z.infer<
  typeof assessmentQuestionOptionListResponseSchema
>;

export const listAssessmentQuestionOptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAssessmentQuestionOptionsQuery = z.infer<
  typeof listAssessmentQuestionOptionsQuerySchema
>;
