import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listOwnAssessments } from "../../../services/api/assessmentAttempts";

/**
 * Trainee-facing Assessments section (Assessments unit): this trainer's own
 * assessments across every course they have effective access to, via the
 * new `GET /assessments` (`listOwnAssessments`). Each row's action-label/
 * badge logic is deliberately copied unchanged from CourseDetailPage.tsx's
 * `AssessmentsSection` (Start Assessment / Retry / Review / View Result,
 * PASS/FAIL badge) — the same existing pattern, not a redesign — with a
 * course-name line added since this list spans multiple courses. Navigates
 * to the existing, untouched `/app/assessments/:id` (TakeAssessmentPage).
 */
export function AssessmentsPage() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["my-assessments"],
    queryFn: listOwnAssessments,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Assessments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Quizzes, mock exams, practical assessments, and tests across your courses.
        </p>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No assessments yet"
        emptyDescription="Assessments from courses you have access to will appear here."
      >
        {(assessments) => (
          <Card>
            <ul className="space-y-2">
              {assessments.map((assessment) => {
                const attemptsExhausted = assessment.my_attempts_used >= assessment.max_attempts;
                const actionLabel =
                  assessment.my_best_result === "PASS"
                    ? "Review"
                    : attemptsExhausted
                      ? "View Result"
                      : assessment.my_attempts_used > 0
                        ? "Retry"
                        : "Start Assessment";
                return (
                  <li
                    key={assessment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ClipboardList
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">{assessment.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {assessment.course_title} · {assessment.passing_marks}/
                          {assessment.total_marks} to pass · {assessment.my_attempts_used}/
                          {assessment.max_attempts} attempts used
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {assessment.my_best_result && (
                        <Badge tone={assessment.my_best_result === "PASS" ? "success" : "warning"}>
                          {assessment.my_best_result}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant={
                          attemptsExhausted && assessment.my_best_result !== "PASS"
                            ? "secondary"
                            : "primary"
                        }
                        className="px-3 py-1.5 text-xs"
                        disabled={attemptsExhausted && assessment.my_best_result === null}
                        onClick={() => void navigate(`/app/assessments/${assessment.id}`)}
                      >
                        {actionLabel}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </RemoteDataView>
    </div>
  );
}
