import {
  apiSuccessSchema,
  assessmentListResponseSchema,
  assessmentResponseSchema,
  assessmentQuestionListResponseSchema,
  assessmentQuestionResponseSchema,
  assessmentQuestionOptionListResponseSchema,
  assessmentQuestionOptionResponseSchema,
  type AssessmentResponse,
  type CreateAssessmentRequest,
  type UpdateAssessmentRequest,
  type AssessmentQuestionResponse,
  type CreateAssessmentQuestionRequest,
  type UpdateAssessmentQuestionRequest,
  type AssessmentQuestionOptionResponse,
  type CreateAssessmentQuestionOptionRequest,
  type UpdateAssessmentQuestionOptionRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const assessmentEnvelope = apiSuccessSchema(assessmentResponseSchema);
const questionEnvelope = apiSuccessSchema(assessmentQuestionResponseSchema);
const optionEnvelope = apiSuccessSchema(assessmentQuestionOptionResponseSchema);

/** Admin CRUD for the Assessment Engine (SYSTEM_PLAN.md §14.4, permission `assessment.manage`). */

export async function listAssessments(courseId: string): Promise<AssessmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/assessments?pageSize=100`);
  return assessmentListResponseSchema.parse(body).data;
}

export async function createAssessment(
  courseId: string,
  input: CreateAssessmentRequest,
): Promise<AssessmentResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/assessments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return assessmentEnvelope.parse(body).data;
}

export async function updateAssessment(
  courseId: string,
  assessmentId: string,
  input: UpdateAssessmentRequest,
): Promise<AssessmentResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/assessments/${assessmentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return assessmentEnvelope.parse(body).data;
}

export async function listAssessmentQuestions(
  courseId: string,
  assessmentId: string,
): Promise<AssessmentQuestionResponse[]> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions?pageSize=100`,
  );
  return assessmentQuestionListResponseSchema.parse(body).data;
}

export async function createAssessmentQuestion(
  courseId: string,
  assessmentId: string,
  input: CreateAssessmentQuestionRequest,
): Promise<AssessmentQuestionResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return questionEnvelope.parse(body).data;
}

export async function updateAssessmentQuestion(
  courseId: string,
  assessmentId: string,
  questionId: string,
  input: UpdateAssessmentQuestionRequest,
): Promise<AssessmentQuestionResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions/${questionId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return questionEnvelope.parse(body).data;
}

export async function listAssessmentQuestionOptions(
  courseId: string,
  assessmentId: string,
  questionId: string,
): Promise<AssessmentQuestionOptionResponse[]> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions/${questionId}/options?pageSize=100`,
  );
  return assessmentQuestionOptionListResponseSchema.parse(body).data;
}

export async function createAssessmentQuestionOption(
  courseId: string,
  assessmentId: string,
  questionId: string,
  input: CreateAssessmentQuestionOptionRequest,
): Promise<AssessmentQuestionOptionResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions/${questionId}/options`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return optionEnvelope.parse(body).data;
}

export async function updateAssessmentQuestionOption(
  courseId: string,
  assessmentId: string,
  questionId: string,
  optionId: string,
  input: UpdateAssessmentQuestionOptionRequest,
): Promise<AssessmentQuestionOptionResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/questions/${questionId}/options/${optionId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return optionEnvelope.parse(body).data;
}
