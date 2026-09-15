import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import {
  assessmentAnswerSchema,
  assessmentAttemptResultSchema,
  assessmentAttemptStatusSchema,
} from "./assessment-attempts.js";

/**
 * Admin manual grading (SYSTEM_PLAN.md §14.4/§19, permission
 * `assessment.grade` — the one permission code the plan names explicitly
 * for assessments; §Open Questions #5). Grades a whole attempt at once
 * (every SHORT_ANSWER/PRACTICAL_MANUAL answer it still has pending), rather
 * than one answer at a time — simpler API surface, and `result`/`score`
 * can only be finalized once every question on the attempt has a mark.
 */

/** GET .../assessments/:assessmentId/attempts — admin oversight/grading queue view. Includes the attempting user's identity, unlike the trainee-facing shape. */
export const adminAssessmentAttemptSchema = z.object({
  id: idSchema,
  assessment_id: idSchema,
  user_id: idSchema,
  user_full_name: z.string(),
  attempt_number: z.number().int(),
  started_at: isoDateStringSchema,
  submitted_at: z.string().nullable(),
  score: z.number().nullable(),
  percentage: z.number().nullable(),
  result: assessmentAttemptResultSchema,
  status: assessmentAttemptStatusSchema,
  answers: z.array(assessmentAnswerSchema),
});
export type AdminAssessmentAttempt = z.infer<typeof adminAssessmentAttemptSchema>;

export const adminAssessmentAttemptListResponseSchema = apiPaginatedSchema(
  adminAssessmentAttemptSchema,
);
export type AdminAssessmentAttemptListResponse = z.infer<
  typeof adminAssessmentAttemptListResponseSchema
>;

export const listAdminAssessmentAttemptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: assessmentAttemptStatusSchema.optional(),
});
export type ListAdminAssessmentAttemptsQuery = z.infer<
  typeof listAdminAssessmentAttemptsQuerySchema
>;

/** POST .../attempts/:id/grade — one mark per still-ungraded question on the attempt. */
export const gradeAssessmentAttemptRequestSchema = z.object({
  grades: z.array(
    z.object({
      question_id: idSchema,
      is_correct: z.boolean().nullable().optional(),
      marks_awarded: z.number().nonnegative(),
    }),
  ),
});
export type GradeAssessmentAttemptRequest = z.infer<typeof gradeAssessmentAttemptRequestSchema>;

export const adminAssessmentAttemptResponseSchema = apiSuccessSchema(adminAssessmentAttemptSchema);
export type AdminAssessmentAttemptResponse = z.infer<typeof adminAssessmentAttemptResponseSchema>;
