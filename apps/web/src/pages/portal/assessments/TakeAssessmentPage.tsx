import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import type {
  AssessmentAttemptResponse,
  SubmitAssessmentAttemptAnswer,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import {
  getAssessmentDetail,
  listOwnAssessments,
  listOwnAttempts,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "../../../services/api/assessmentAttempts";
import { QuizQuestionCard } from "./QuizQuestionCard";
import {
  ASSESSMENT_TYPE_LABEL,
  formatAssessmentDate,
  formatPercentage,
  resultLabel,
} from "./assessmentLabels";

/** The reference's full-width notice bar under the title. */
function Banner({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-center text-sm ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-indigo-200 bg-indigo-100/70 text-indigo-900"
      }`}
    >
      {children}
    </div>
  );
}

const QUESTION_GRID = "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3";

/**
 * Take/review flow for one assessment (SYSTEM_PLAN.md §19/§26). No questions
 * are shown until the trainee explicitly starts an attempt (the assessment
 * detail itself never carries `is_correct` — §19: "the client never receives
 * correct answers before submission"). Every SINGLE_CHOICE/MULTIPLE_CHOICE/
 * TRUE_FALSE question is a single-select (radio) list — this schema records
 * one `selected_option_id` per answer, not a multi-value set (see
 * assessment-attempts.service.ts's own comment on this), so that's the honest
 * limit of what a MULTIPLE_CHOICE question can capture here. Answers live in
 * local state and are sent together on submit (there is no autosave), exactly
 * as before; the redesign is presentation only — question cards, a score
 * banner and a per-attempt review built from the caller's own attempts.
 */
export function TakeAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttemptResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, SubmitAssessmentAttemptAnswer>>({});
  const [reviewId, setReviewId] = useState<string | null>(null);

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

  // Same cached query the Assessments list uses — only for the course name in the header.
  const summaryQuery = useQuery({
    queryKey: ["my-assessments"],
    queryFn: listOwnAssessments,
  });
  const summary = summaryQuery.data?.find((a) => a.id === id);

  const startMutation = useMutation({
    mutationFn: () => startAssessmentAttempt(id!),
    onSuccess: (attempt) => {
      setActiveAttempt(attempt);
      setAnswers({});
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to start attempt.");
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitAssessmentAttempt(activeAttempt!.id, { answers: Object.values(answers) }),
    onSuccess: async (attempt) => {
      // Refresh everything that shows attempt counts/results BEFORE revealing the
      // result, so the header ("x/y attempts used"), attempt history, the
      // Assessments list and the course page are never stale next to the score.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assessment-own-attempts", id] }),
        queryClient.invalidateQueries({ queryKey: ["assessment-detail", id] }),
        queryClient.invalidateQueries({ queryKey: ["user-course-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["my-assessments"] }),
        queryClient.invalidateQueries({ queryKey: ["my-assessment-history"] }),
      ]);
      setActiveAttempt(attempt);
      setReviewId(attempt.id);
      toast.success("Assessment submitted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to submit.");
    },
  });

  const questions = useMemo(() => detailQuery.data?.questions ?? [], [detailQuery.data]);
  const attempts = useMemo(() => attemptsQuery.data ?? [], [attemptsQuery.data]);
  const isTaking = activeAttempt?.status === "IN_PROGRESS";
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  // The attempt shown in the review grid: the one just submitted / picked in the
  // history, otherwise the latest submitted or graded one.
  const reviewable = attempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
  const reviewAttempt =
    (reviewId
      ? (reviewable.find((a) => a.id === reviewId) ??
        (activeAttempt?.id === reviewId && activeAttempt.status !== "IN_PROGRESS"
          ? activeAttempt
          : undefined))
      : undefined) ?? reviewable[0];
  // The server resumes an open attempt even once attempts are used up, so offer it.
  const openAttempt = attempts.find((a) => a.status === "IN_PROGRESS");

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
        {(assessment) => {
          const canStart = assessment.my_attempts_remaining > 0 || !!openAttempt;
          const reviewedAnswered = reviewAttempt
            ? reviewAttempt.answers.filter(
                (a) => a.selected_option_id !== null || a.answer_text !== null,
              ).length
            : null;
          const answered = isTaking ? answeredCount : reviewedAnswered;
          const result = reviewAttempt ? resultLabel(reviewAttempt.result, true) : null;

          return (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-medium text-indigo-950">{assessment.title}</h2>
                <p className="mt-1.5 text-xs text-slate-600">
                  {summary && (
                    <>
                      <strong className="font-semibold">Course:</strong> {summary.course_title}
                      {" | "}
                    </>
                  )}
                  <strong className="font-semibold">Type:</strong>{" "}
                  {ASSESSMENT_TYPE_LABEL[assessment.type]}
                  {" | "}
                  <strong className="font-semibold">Total Questions:</strong> {questions.length}
                  {answered !== null && (
                    <>
                      {" | "}
                      <strong className="font-semibold">Answered:</strong> {answered}
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {assessment.passing_marks}/{assessment.total_marks} to pass
                  {" · "}
                  {assessment.my_attempts_used}/{assessment.max_attempts} attempts used
                  {assessment.duration_minutes && ` · ${assessment.duration_minutes} min`}
                  {assessment.due_date && ` · Due ${formatAssessmentDate(assessment.due_date)}`}
                </p>
                {assessment.description && (
                  <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                    {assessment.description}
                  </p>
                )}
              </div>

              {isTaking && activeAttempt && (
                <Banner>
                  Attempt #{activeAttempt.attempt_number} in progress — {answeredCount} of{" "}
                  {questions.length} answered.
                </Banner>
              )}

              {!isTaking && reviewAttempt && (
                <>
                  {reviewAttempt.status === "SUBMITTED" ? (
                    <Banner tone="warning">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        Attempt #{reviewAttempt.attempt_number} submitted — awaiting manual grading
                        for one or more questions.
                      </span>
                    </Banner>
                  ) : (
                    <Banner>
                      You scored <strong>{reviewAttempt.score}</strong> out of{" "}
                      <strong>{assessment.total_marks}</strong>.
                      {reviewAttempt.percentage !== null &&
                        ` (${formatPercentage(reviewAttempt.percentage)})`}{" "}
                      {result && <Badge tone={result.tone}>{result.label}</Badge>}
                      <span className="mt-1 block text-xs text-indigo-800/80">
                        Attempt #{reviewAttempt.attempt_number}
                        {reviewAttempt.submitted_at &&
                          ` · Completed ${formatAssessmentDate(reviewAttempt.submitted_at)}`}
                        {` · Pass mark ${assessment.passing_marks}/${assessment.total_marks}`}
                      </span>
                    </Banner>
                  )}
                </>
              )}

              {!isTaking && (
                <Card>
                  {canStart ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        {openAttempt
                          ? `You have an attempt in progress (attempt #${openAttempt.attempt_number}). Answers are only saved when you submit.`
                          : `This assessment has ${questions.length} question(s). Once you start, your time begins counting toward your training hours.`}
                      </p>
                      <Button
                        type="button"
                        disabled={startMutation.isPending}
                        onClick={() => startMutation.mutate()}
                      >
                        {startMutation.isPending
                          ? "Starting…"
                          : openAttempt
                            ? "Continue Attempt"
                            : "Start Attempt"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      You have used all {assessment.max_attempts} attempt(s) for this assessment.
                    </p>
                  )}
                </Card>
              )}

              {isTaking && (
                <>
                  <div className={QUESTION_GRID}>
                    {questions.map((question, index) => (
                      <QuizQuestionCard
                        key={question.id}
                        mode="take"
                        index={index}
                        question={question}
                        answer={answers[question.id]}
                        onChoose={setChoice}
                        onText={setText}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
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

              {!isTaking && reviewAttempt && (
                <div className={QUESTION_GRID}>
                  {questions.map((question, index) => (
                    <QuizQuestionCard
                      key={question.id}
                      mode="review"
                      index={index}
                      question={question}
                      recorded={reviewAttempt.answers.find((a) => a.question_id === question.id)}
                    />
                  ))}
                </div>
              )}

              <RemoteDataView
                isLoading={attemptsQuery.isLoading}
                isError={attemptsQuery.isError}
                error={attemptsQuery.error}
                data={attemptsQuery.data}
              >
                {(list) =>
                  list.length > 0 ? (
                    <Card>
                      <h3 className="mb-3 text-sm font-semibold text-slate-900">Attempt History</h3>
                      <ul className="divide-y divide-slate-100">
                        {list.map((attempt) => {
                          const done =
                            attempt.status === "SUBMITTED" || attempt.status === "GRADED";
                          const attemptResult = done ? resultLabel(attempt.result, true) : null;
                          return (
                            <li
                              key={attempt.id}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-slate-600"
                            >
                              <span>
                                Attempt #{attempt.attempt_number} —{" "}
                                {new Date(attempt.started_at).toLocaleDateString()}
                                {attempt.status === "GRADED" && attempt.percentage !== null && (
                                  <span className="text-xs text-slate-500">
                                    {" "}
                                    · {attempt.score} marks ({formatPercentage(attempt.percentage)})
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                {attemptResult ? (
                                  <Badge tone={attemptResult.tone}>{attemptResult.label}</Badge>
                                ) : (
                                  <Badge tone="neutral">
                                    {attempt.status === "IN_PROGRESS" ? "In progress" : "Expired"}
                                  </Badge>
                                )}
                                {done && (
                                  <Button
                                    type="button"
                                    variant={
                                      reviewAttempt?.id === attempt.id ? "secondary" : "ghost"
                                    }
                                    className="px-2 py-1 text-xs"
                                    disabled={isTaking}
                                    onClick={() => setReviewId(attempt.id)}
                                  >
                                    {reviewAttempt?.id === attempt.id ? "Viewing" : "Review"}
                                  </Button>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  ) : null
                }
              </RemoteDataView>
            </>
          );
        }}
      </RemoteDataView>
    </div>
  );
}
