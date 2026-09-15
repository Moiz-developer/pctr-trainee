import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { AdminAssessmentAttempt, AssessmentResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ApiClientError } from "../../../services/api/client";
import {
  gradeAssessmentAttempt,
  listAttemptsForGrading,
} from "../../../services/api/assessmentGrading";

const STATUS_TONE: Record<AdminAssessmentAttempt["status"], BadgeTone> = {
  IN_PROGRESS: "info",
  SUBMITTED: "warning",
  GRADED: "success",
  EXPIRED: "neutral",
};

const RESULT_TONE: Record<AdminAssessmentAttempt["result"], BadgeTone> = {
  PENDING: "neutral",
  PASS: "success",
  FAIL: "danger",
};

/** One attempt's grading form — a marks input per still-pending (SHORT_ANSWER/PRACTICAL_MANUAL) answer. */
function GradeAttemptForm({
  courseId,
  assessmentId,
  attempt,
  onDone,
}: {
  courseId: string;
  assessmentId: string;
  attempt: AdminAssessmentAttempt;
  onDone: () => void;
}) {
  const pending = attempt.answers.filter((a) => a.is_correct === null);
  const [marks, setMarks] = useState<Record<string, number>>(
    Object.fromEntries(pending.map((a) => [a.question_id, 0])),
  );

  const mutation = useMutation({
    mutationFn: () =>
      gradeAssessmentAttempt(courseId, assessmentId, attempt.id, {
        grades: pending.map((a) => ({
          question_id: a.question_id,
          marks_awarded: marks[a.question_id] ?? 0,
        })),
      }),
    onSuccess: onDone,
  });

  if (pending.length === 0) return null;

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      {pending.map((answer) => (
        <div key={answer.question_id}>
          <p className="text-xs text-slate-600">
            Answer: <span className="italic">{answer.answer_text || "(no answer submitted)"}</span>
          </p>
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-700">
            Marks awarded
            <input
              type="number"
              min="0"
              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
              value={marks[answer.question_id] ?? 0}
              onChange={(event) =>
                setMarks((prev) => ({
                  ...prev,
                  [answer.question_id]: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
      ))}
      {mutation.isError && (
        <p className="text-xs text-red-600">
          {mutation.error instanceof ApiClientError ? mutation.error.message : "Failed to grade."}
        </p>
      )}
      <Button
        type="button"
        className="px-3 py-1.5 text-xs"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Saving…" : "Submit Grades"}
      </Button>
    </div>
  );
}

/** Admin oversight/grading queue for one assessment (SYSTEM_PLAN.md §Open Questions #5, permission `assessment.grade`). */
export function AssessmentAttemptsModal({
  open,
  onClose,
  courseId,
  assessment,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  assessment: AssessmentResponse;
}) {
  const queryClient = useQueryClient();
  const [gradingAttemptId, setGradingAttemptId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["assessment-attempts-admin", assessment.id],
    queryFn: () => listAttemptsForGrading(courseId, assessment.id),
    enabled: open,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["assessment-attempts-admin", assessment.id] });
    setGradingAttemptId(null);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Attempts — ${assessment.title}`} wide>
      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No attempts yet"
      >
        {(attempts) => (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{attempt.user_full_name}</p>
                    <p className="text-xs text-slate-500">
                      Attempt #{attempt.attempt_number} ·{" "}
                      {new Date(attempt.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[attempt.status]}>{attempt.status}</Badge>
                    <Badge tone={RESULT_TONE[attempt.result]}>
                      {attempt.result}
                      {attempt.percentage !== null ? ` (${attempt.percentage}%)` : ""}
                    </Badge>
                    {attempt.status === "SUBMITTED" && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() =>
                          setGradingAttemptId(gradingAttemptId === attempt.id ? null : attempt.id)
                        }
                      >
                        Grade
                      </Button>
                    )}
                  </div>
                </div>
                {attempt.status === "GRADED" && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    {attempt.result === "PASS" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                    )}
                    Score: {attempt.score}
                  </div>
                )}
                {gradingAttemptId === attempt.id && (
                  <GradeAttemptForm
                    courseId={courseId}
                    assessmentId={assessment.id}
                    attempt={attempt}
                    onDone={() => void invalidate()}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </RemoteDataView>

      {query.isFetching && !query.isLoading && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Refreshing…
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
