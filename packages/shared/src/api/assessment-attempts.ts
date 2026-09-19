import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { assessmentQuestionTypeSchema, assessmentTypeSchema } from "./assessments.js";

/**
 * Trainee-facing Assessment Engine API (SYSTEM_PLAN.md §26 `POST
 * /assessments/:id/attempts`, `POST /assessments/attempts/:id/submit`, §19).
 * Deliberately a separate, smaller/sanitized shape from assessments.ts's
 * admin DTOs: no `is_correct` on options here (§19: "the client never
 * receives correct answers before submission"), no `status`/full config —
 * only what a trainee attempting the assessment needs to see. Options are
 * never exposed for SHORT_ANSWER/PRACTICAL_MANUAL questions (there are
 * none, per §14.4).
 */

export const assessmentAttemptStatusSchema = z.enum([
  "IN_PROGRESS",
  "SUBMITTED",
  "GRADED",
  "EXPIRED",
]);
export type AssessmentAttemptStatus = z.infer<typeof assessmentAttemptStatusSchema>;

export const assessmentAttemptResultSchema = z.enum(["PENDING", "PASS", "FAIL"]);
export type AssessmentAttemptResult = z.infer<typeof assessmentAttemptResultSchema>;

/** GET /api/v1/assessments/:id — sanitized question/option list for attempting. */
export const assessmentAttemptOptionSchema = z.object({
  id: idSchema,
  option_text: z.string(),
  sort_order: z.number().int(),
});
export type AssessmentAttemptOption = z.infer<typeof assessmentAttemptOptionSchema>;

export const assessmentAttemptQuestionSchema = z.object({
  id: idSchema,
  question_text: z.string(),
  question_type: assessmentQuestionTypeSchema,
  marks: z.number().int(),
  sort_order: z.number().int(),
  options: z.array(assessmentAttemptOptionSchema),
});
export type AssessmentAttemptQuestion = z.infer<typeof assessmentAttemptQuestionSchema>;

/**
 * `my_attempts_used`/`my_attempts_remaining`/`my_best_result` are derived
 * server-side from the caller's own attempts — never client-supplied,
 * needed so the trainee UI can show "2 of 3 attempts used" without a
 * separate round trip.
 */
export const assessmentDetailSchema = z.object({
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
  my_attempts_used: z.number().int(),
  my_attempts_remaining: z.number().int(),
  my_best_result: assessmentAttemptResultSchema.nullable(),
  questions: z.array(assessmentAttemptQuestionSchema),
});
export type AssessmentDetail = z.infer<typeof assessmentDetailSchema>;

export const assessmentDetailResponseSchema = apiSuccessSchema(assessmentDetailSchema);
export type AssessmentDetailResponse = z.infer<typeof assessmentDetailResponseSchema>;

/** One of the caller's own answers, as recorded on an attempt — `is_correct`/`marks_awarded` are null until (auto- or manually-) graded. */
export const assessmentAnswerSchema = z.object({
  question_id: idSchema,
  selected_option_id: idSchema.nullable(),
  answer_text: z.string().nullable(),
  is_correct: z.boolean().nullable(),
  marks_awarded: z.number().nullable(),
});
export type AssessmentAnswer = z.infer<typeof assessmentAnswerSchema>;

/** GET/POST .../attempts response shape — the caller's own attempt only. */
export const assessmentAttemptResponseSchema = z.object({
  id: idSchema,
  assessment_id: idSchema,
  attempt_number: z.number().int(),
  started_at: isoDateStringSchema,
  submitted_at: z.string().nullable(),
  score: z.number().nullable(),
  percentage: z.number().nullable(),
  result: assessmentAttemptResultSchema,
  status: assessmentAttemptStatusSchema,
  answers: z.array(assessmentAnswerSchema),
});
export type AssessmentAttemptResponse = z.infer<typeof assessmentAttemptResponseSchema>;

export const assessmentAttemptDetailResponseSchema = apiSuccessSchema(
  assessmentAttemptResponseSchema,
);
export type AssessmentAttemptDetailResponse = z.infer<typeof assessmentAttemptDetailResponseSchema>;

/** GET /api/v1/assessments/:id/attempts — the caller's own attempt history for this assessment. */
export const assessmentAttemptListResponseSchema = apiPaginatedSchema(
  assessmentAttemptResponseSchema,
);
export type AssessmentAttemptListResponse = z.infer<typeof assessmentAttemptListResponseSchema>;

/**
 * The trainee's own standing on one assessment, derived server-side from their
 * attempts (never stored): NOT_STARTED = no attempt; IN_PROGRESS = an attempt is
 * open (even if an earlier one was submitted); COMPLETED = at least one attempt
 * submitted and none open. Pass/fail is `my_best_result`, kept separate.
 */
export const myAssessmentStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
export type MyAssessmentStatus = z.infer<typeof myAssessmentStatusSchema>;

/**
 * GET /api/v1/assessments — trainee-facing Assessments section (Assessments
 * unit): this caller's own PUBLISHED assessments across every course they
 * have effective access to. The same lightweight per-assessment shape
 * `courseDetailAssessmentSchema` uses (title/type/marks/attempts/best-result),
 * plus `course_id`/`course_title` since this list spans multiple courses, and
 * the fields the Assessments cards show: due date, when it became available
 * (`assigned_at` = the assessment's creation time; assignment itself is
 * course access and has no date of its own), the derived status, and the best
 * completed attempt's score.
 */
export const myAssessmentSummarySchema = z.object({
  id: idSchema,
  course_id: idSchema,
  course_title: z.string(),
  title: z.string(),
  type: assessmentTypeSchema,
  total_marks: z.number().int(),
  passing_marks: z.number().int(),
  max_attempts: z.number().int(),
  due_date: z.string().nullable(),
  assigned_at: isoDateStringSchema,
  my_attempts_used: z.number().int(),
  my_status: myAssessmentStatusSchema,
  my_best_result: assessmentAttemptResultSchema.nullable(),
  my_best_score: z.number().nullable(),
  my_best_percentage: z.number().nullable(),
  my_last_submitted_at: z.string().nullable(),
});
export type MyAssessmentSummary = z.infer<typeof myAssessmentSummarySchema>;

export const myAssessmentListResponseSchema = apiPaginatedSchema(myAssessmentSummarySchema);
export type MyAssessmentListResponse = z.infer<typeof myAssessmentListResponseSchema>;

/**
 * GET /api/v1/assessments/history — one row per SUBMITTED/GRADED attempt the
 * caller has made, newest first, across every assessment they can still access
 * (the same visibility as the list above, so a row's "View" link always works).
 */
export const myAssessmentHistoryItemSchema = z.object({
  attempt_id: idSchema,
  assessment_id: idSchema,
  assessment_title: z.string(),
  course_id: idSchema,
  course_title: z.string(),
  type: assessmentTypeSchema,
  attempt_number: z.number().int(),
  submitted_at: z.string().nullable(),
  score: z.number().nullable(),
  percentage: z.number().nullable(),
  total_marks: z.number().int(),
  passing_marks: z.number().int(),
  result: assessmentAttemptResultSchema,
});
export type MyAssessmentHistoryItem = z.infer<typeof myAssessmentHistoryItemSchema>;

export const myAssessmentHistoryListResponseSchema = apiPaginatedSchema(
  myAssessmentHistoryItemSchema,
);
export type MyAssessmentHistoryListResponse = z.infer<typeof myAssessmentHistoryListResponseSchema>;

/**
 * POST /api/v1/assessments/attempts/:id/submit. One answer per question the
 * trainee chose to answer — an omitted question is simply unanswered
 * (scored as 0 marks / incorrect for auto-graded types), not a validation
 * error, since SYSTEM_PLAN.md defines no "all questions mandatory" rule.
 */
export const submitAssessmentAttemptAnswerSchema = z
  .object({
    question_id: idSchema,
    selected_option_id: idSchema.optional(),
    answer_text: z.string().min(1).optional(),
  })
  .refine((data) => !(data.selected_option_id && data.answer_text), {
    message: "Provide either selected_option_id or answer_text, not both.",
    path: ["selected_option_id"],
  });
export type SubmitAssessmentAttemptAnswer = z.infer<typeof submitAssessmentAttemptAnswerSchema>;

export const submitAssessmentAttemptRequestSchema = z.object({
  answers: z.array(submitAssessmentAttemptAnswerSchema),
});
export type SubmitAssessmentAttemptRequest = z.infer<typeof submitAssessmentAttemptRequestSchema>;
