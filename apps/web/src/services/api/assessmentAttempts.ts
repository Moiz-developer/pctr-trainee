import {
  apiSuccessSchema,
  assessmentDetailResponseSchema,
  assessmentAttemptResponseSchema,
  assessmentAttemptListResponseSchema,
  myAssessmentListResponseSchema,
  type AssessmentDetail,
  type AssessmentAttemptResponse,
  type SubmitAssessmentAttemptRequest,
  type MyAssessmentSummary,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const attemptEnvelope = apiSuccessSchema(assessmentAttemptResponseSchema);

/** Trainee-facing Assessment Engine (SYSTEM_PLAN.md §26/§19) — self-only, real server-side scoring. */
export async function getAssessmentDetail(assessmentId: string): Promise<AssessmentDetail> {
  const body = await apiFetch<unknown>(`/assessments/${assessmentId}`);
  return assessmentDetailResponseSchema.parse(body).data;
}

/** GET /api/v1/assessments (Assessments unit) — this caller's own assessments across every accessible course. */
export async function listOwnAssessments(): Promise<MyAssessmentSummary[]> {
  const body = await apiFetch<unknown>("/assessments");
  return myAssessmentListResponseSchema.parse(body).data;
}

export async function startAssessmentAttempt(
  assessmentId: string,
): Promise<AssessmentAttemptResponse> {
  const body = await apiFetch<unknown>(`/assessments/${assessmentId}/attempts`, { method: "POST" });
  return attemptEnvelope.parse(body).data;
}

export async function listOwnAttempts(assessmentId: string): Promise<AssessmentAttemptResponse[]> {
  const body = await apiFetch<unknown>(`/assessments/${assessmentId}/attempts`);
  return assessmentAttemptListResponseSchema.parse(body).data;
}

export async function getOwnAttempt(attemptId: string): Promise<AssessmentAttemptResponse> {
  const body = await apiFetch<unknown>(`/assessments/attempts/${attemptId}`);
  return attemptEnvelope.parse(body).data;
}

export async function submitAssessmentAttempt(
  attemptId: string,
  input: SubmitAssessmentAttemptRequest,
): Promise<AssessmentAttemptResponse> {
  const body = await apiFetch<unknown>(`/assessments/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return attemptEnvelope.parse(body).data;
}
