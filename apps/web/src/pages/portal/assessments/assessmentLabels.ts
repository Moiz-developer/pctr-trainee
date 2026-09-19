import type {
  AssessmentAttemptResult,
  AssessmentType,
  MyAssessmentStatus,
} from "@internal-training/shared";

export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  QUIZ: "Quiz",
  MOCK_EXAM: "Mock Exam",
  PRACTICAL: "Practical Assessment",
  TEST: "Test",
  OTHER: "Other",
};

export const ASSESSMENT_STATUS_LABEL: Record<MyAssessmentStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

/** "04 September 2026" — the long date format the Assessments cards and history use. */
export function formatAssessmentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Percentage as the server stores it (two decimals), shown without trailing zeros: 78, 78.5. */
export function formatPercentage(percentage: number): string {
  return `${Math.round(percentage * 10) / 10}%`;
}

/**
 * The Result label for an assessment or attempt: Passed / Failed, or "Pending
 * review" for a submitted attempt still awaiting manual grading. `null` (show
 * nothing) when there is no submitted attempt to have a result.
 */
export function resultLabel(
  result: AssessmentAttemptResult | null,
  hasCompletedAttempt: boolean,
): { label: string; tone: "success" | "danger" | "warning" } | null {
  if (result === "PASS") return { label: "Passed", tone: "success" };
  if (result === "FAIL") return { label: "Failed", tone: "danger" };
  if (result === "PENDING" && hasCompletedAttempt)
    return { label: "Pending review", tone: "warning" };
  return null;
}
