import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type {
  AssessmentAttemptResponse,
  SubmitAssessmentAttemptAnswer,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ApiClientError } from "../../../services/api/client";
import {
  getAssessmentDetail,
  listOwnAttempts,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "../../../services/api/assessmentAttempts";

const RESULT_TONE: Record<string, BadgeTone> = {
  PENDING: "neutral",
  PASS: "success",
  FAIL: "danger",
};

function AttemptResultCard({ attempt }: { attempt: AssessmentAttemptResponse }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Attempt #{attempt.attempt_number} Result
        </h3>
        <Badge tone={RESULT_TONE[attempt.result]}>{attempt.result}</Badge>
      </div>
      {attempt.status === "SUBMITTED" ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Submitted — awaiting manual grading for one or more questions.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Score: {attempt.score} ({attempt.percentage}%)
        </p>
      )}
      {attempt.answers.length > 0 && attempt.status !== "SUBMITTED" && (
        <ul className="mt-3 space-y-1.5">
          {attempt.answers.map((answer) => (
            <li key={answer.question_id} className="flex items-center gap-2 text-xs text-slate-600">
              {answer.is_correct === true ? (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                  aria-hidden="true"
                />
              ) : answer.is_correct === false ? (
                <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />
              ) : (
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              )}
              {answer.marks_awarded !== null ? `${answer.marks_awarded} marks` : "Pending grading"}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Take/review flow for one assessment (SYSTEM_PLAN.md §19/§26). No
 * questions are shown until the trainee explicitly starts an attempt (the
 * assessment detail itself never carries `is_correct` — §19: "the client
 * never receives correct answers before submission"). Every SINGLE_CHOICE/
 * MULTIPLE_CHOICE/TRUE_FALSE question is rendered as a single-select
 * (radio) list — this schema records one `selected_option_id` per answer,
 * not a multi-value set (see assessment-attempts.service.ts's own comment
 * on this), so that's the honest limit of what a MULTIPLE_CHOICE question
 * can capture here.
 */
export function TakeAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttemptResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, SubmitAssessmentAttemptAnswer>>({});

  const detailQuery = useQuery({
    queryKey: ["assessment-detail", id],
    queryFn: () => getAssessmentDetail(id!),
    enabled: !!id,
  });

  const attemptsQuery = useQuery({
    queryKey: ["assessment-own-attempts", id],
    queryFn: () => listOwnAttempts(id!),
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: () => startAssessmentAttempt(id!),
    onSuccess: (attempt) => {
      setActiveAttempt(attempt);
      setAnswers({});
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitAssessmentAttempt(activeAttempt!.id, { answers: Object.values(answers) }),
    onSuccess: async (attempt) => {
      setActiveAttempt(attempt);
      await queryClient.invalidateQueries({ queryKey: ["assessment-own-attempts", id] });
      await queryClient.invalidateQueries({ queryKey: ["user-course-detail"] });
    },
  });

  const questions = detailQuery.data?.questions ?? [];
  const isSubmitted = activeAttempt && activeAttempt.status !== "IN_PROGRESS";

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  function setChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { question_id: questionId, selected_option_id: optionId },
    }));
  }
  function setText(questionId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { question_id: questionId, answer_text: text },
    }));
  }

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate(-1)}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <RemoteDataView
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
        data={detailQuery.data}
        onRetry={() => void detailQuery.refetch()}
      >
        {(assessment) => (
          <>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{assessment.title}</h2>
              {assessment.description && (
                <p className="mt-2 text-sm text-slate-600">{assessment.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  {assessment.passing_marks}/{assessment.total_marks} to pass
                </span>
                <span>
                  {assessment.my_attempts_used}/{assessment.max_attempts} attempts used
                </span>
                {assessment.duration_minutes && <span>{assessment.duration_minutes} min</span>}
              </div>
            </div>

            {!activeAttempt && (
              <Card>
                {assessment.my_attempts_remaining > 0 ? (
                  <>
                    <p className="mb-3 text-sm text-slate-600">
                      This assessment has {questions.length} question(s). Once you start, your time
                      begins counting toward your training hours.
                    </p>
                    {startMutation.isError && (
                      <p className="mb-2 flex items-center gap-1.5 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {startMutation.error instanceof ApiClientError
                          ? startMutation.error.message
                          : "Failed to start attempt."}
                      </p>
                    )}
                    <Button
                      type="button"
                      disabled={startMutation.isPending}
                      onClick={() => startMutation.mutate()}
                    >
                      {startMutation.isPending ? "Starting…" : "Start Attempt"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    You have used all {assessment.max_attempts} attempt(s) for this assessment.
                  </p>
                )}
              </Card>
            )}

            {activeAttempt && !isSubmitted && (
              <>
                <Card>
                  <ul className="space-y-5">
                    {questions.map((question, index) => (
                      <li key={question.id}>
                        <p className="text-sm font-medium text-slate-900">
                          {index + 1}. {question.question_text}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            ({question.marks} pts)
                          </span>
                        </p>
                        {question.options.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 text-sm text-slate-700"
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  checked={answers[question.id]?.selected_option_id === option.id}
                                  onChange={() => setChoice(question.id, option.id)}
                                />
                                {option.option_text}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            rows={3}
                            value={answers[question.id]?.answer_text ?? ""}
                            onChange={(event) => setText(question.id, event.target.value)}
                            placeholder="Your answer…"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>

                {submitMutation.isError && (
                  <p className="flex items-center gap-1.5 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {submitMutation.error instanceof ApiClientError
                      ? submitMutation.error.message
                      : "Failed to submit."}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    disabled={submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    {submitMutation.isPending ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Submitting…
                      </span>
                    ) : (
                      "Submit Assessment"
                    )}
                  </Button>
                  <p className="text-xs text-slate-500">
                    {answeredCount}/{questions.length} answered
                  </p>
                </div>
              </>
            )}

            {activeAttempt && isSubmitted && <AttemptResultCard attempt={activeAttempt} />}

            <RemoteDataView
              isLoading={attemptsQuery.isLoading}
              isError={attemptsQuery.isError}
              error={attemptsQuery.error}
              data={attemptsQuery.data}
              isEmpty={(items) => items.length === 0}
              emptyTitle="No past attempts"
            >
              {(attempts) =>
                attempts.length > 0 ? (
                  <Card>
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">Attempt History</h3>
                    <ul className="space-y-2">
                      {attempts.map((attempt) => (
                        <li
                          key={attempt.id}
                          className="flex items-center justify-between text-sm text-slate-600"
                        >
                          <span>
                            Attempt #{attempt.attempt_number} —{" "}
                            {new Date(attempt.started_at).toLocaleDateString()}
                          </span>
                          <Badge tone={RESULT_TONE[attempt.result]}>{attempt.result}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null
              }
            </RemoteDataView>
          </>
        )}
      </RemoteDataView>
    </div>
  );
}
