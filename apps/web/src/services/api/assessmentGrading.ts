import {
  apiSuccessSchema,
  adminAssessmentAttemptListResponseSchema,
  adminAssessmentAttemptSchema,
  type AdminAssessmentAttempt,
  type GradeAssessmentAttemptRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const attemptEnvelope = apiSuccessSchema(adminAssessmentAttemptSchema);

/** Admin oversight/grading of attempts (SYSTEM_PLAN.md §Open Questions #5, permission `assessment.grade`). */
export async function listAttemptsForGrading(
  courseId: string,
  assessmentId: string,
  status?: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "EXPIRED",
): Promise<AdminAssessmentAttempt[]> {
  const qs = new URLSearchParams({ pageSize: "100" });
  if (status) qs.set("status", status);
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/attempts?${qs.toString()}`,
  );
  return adminAssessmentAttemptListResponseSchema.parse(body).data;
}

export async function gradeAssessmentAttempt(
  courseId: string,
  assessmentId: string,
  attemptId: string,
  input: GradeAssessmentAttemptRequest,
): Promise<AdminAssessmentAttempt> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/assessments/${assessmentId}/attempts/${attemptId}/grade`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return attemptEnvelope.parse(body).data;
}
