import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { MyAssessmentSummary } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import {
  listAssessmentHistory,
  listOwnAssessments,
} from "../../../services/api/assessmentAttempts";
import {
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_TYPE_LABEL,
  formatAssessmentDate,
  formatPercentage,
  resultLabel,
} from "./assessmentLabels";

type Tab = "CURRENT" | "HISTORY";
type StatusFilter = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PASSED" | "FAILED";

const TABS: { key: Tab; label: string }[] = [
  { key: "CURRENT", label: "My Assessments" },
  { key: "HISTORY", label: "History" },
];

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NOT_STARTED", label: "Not Started" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PASSED", label: "Passed" },
  { key: "FAILED", label: "Failed" },
];

const STATUS_TONE: Record<MyAssessmentSummary["my_status"], BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

function matchesFilter(assessment: MyAssessmentSummary, filter: StatusFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "PASSED":
      return assessment.my_best_result === "PASS";
    case "FAILED":
      return assessment.my_best_result === "FAIL";
    default:
      return assessment.my_status === filter;
  }
}

const ACTION_LABEL: Record<MyAssessmentSummary["my_status"], string> = {
  NOT_STARTED: "Start Assessment",
  IN_PROGRESS: "Continue Assessment",
  COMPLETED: "View Result",
};

/** One label/value line on an assessment card. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}

function AssessmentCard({ assessment, now }: { assessment: MyAssessmentSummary; now: number }) {
  const navigate = useNavigate();
  const completed =
    assessment.my_status === "COMPLETED" || assessment.my_last_submitted_at !== null;
  const result = resultLabel(assessment.my_best_result, completed);
  const overdue =
    assessment.due_date !== null &&
    assessment.my_status !== "COMPLETED" &&
    new Date(assessment.due_date).getTime() < now;
  // A finished assessment's result can always be reviewed; only an open/new one is "started".
  const actionLabel = ACTION_LABEL[assessment.my_status];

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-indigo-950">{assessment.title}</h3>
        <Badge tone={STATUS_TONE[assessment.my_status]} solid>
          {ASSESSMENT_STATUS_LABEL[assessment.my_status]}
        </Badge>
      </div>

      <dl className="mt-4 space-y-2">
        <Detail label="Course">{assessment.course_title}</Detail>
        <Detail label="Type">{ASSESSMENT_TYPE_LABEL[assessment.type]}</Detail>
        <Detail label="Date assigned">{formatAssessmentDate(assessment.assigned_at)}</Detail>
        {assessment.due_date && (
          <Detail label="Due date">
            <span className={overdue ? "text-red-600" : undefined}>
              {formatAssessmentDate(assessment.due_date)}
              {overdue ? " (overdue)" : ""}
            </span>
          </Detail>
        )}
        {assessment.my_best_percentage !== null && (
          <Detail label="Score">
            {formatPercentage(assessment.my_best_percentage)}
            {assessment.my_best_score !== null && (
              <span className="font-normal text-slate-500">
                {" "}
                ({assessment.my_best_score}/{assessment.total_marks} marks)
              </span>
            )}
          </Detail>
        )}
        {result && (
          <Detail label="Result">
            <Badge tone={result.tone}>{result.label}</Badge>
          </Detail>
        )}
        {assessment.my_last_submitted_at && (
          <Detail label="Completed on">
            {formatAssessmentDate(assessment.my_last_submitted_at)}
          </Detail>
        )}
        <Detail label="Pass mark">
          {assessment.passing_marks}/{assessment.total_marks}
        </Detail>
        <Detail label="Attempts">
          {assessment.my_attempts_used}/{assessment.max_attempts}
        </Detail>
      </dl>

      <div className="mt-4 flex-1" />
      <Button
        type="button"
        variant={assessment.my_status === "COMPLETED" ? "secondary" : "primary"}
        className="w-full"
        onClick={() => void navigate(`/app/assessments/${assessment.id}`)}
      >
        {actionLabel}
      </Button>
    </Card>
  );
}

function CurrentAssessments() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  // Fixed at mount so render stays pure; only used to flag overdue due dates.
  const [now] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["my-assessments"],
    queryFn: listOwnAssessments,
  });

  const all = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ key }) => [key, all.filter((a) => matchesFilter(a, key)).length]),
      ) as Record<StatusFilter, number>,
    [all],
  );
  const visible = useMemo(() => all.filter((a) => matchesFilter(a, filter)), [all, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm font-semibold text-indigo-950">Filter:</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "border-indigo-900 bg-indigo-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-indigo-900 hover:text-indigo-900"
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data ? visible : undefined}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle={filter === "ALL" ? "No assessments yet" : "No assessments in this view"}
        emptyDescription={
          filter === "ALL"
            ? "Assessments from courses you have access to will appear here."
            : "Try a different filter."
        }
      >
        {(assessments) => (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {assessments.map((assessment) => (
              <AssessmentCard key={assessment.id} assessment={assessment} now={now} />
            ))}
          </div>
        )}
      </RemoteDataView>
    </div>
  );
}

/** Every completed attempt, newest first, so earlier performance can be reviewed at a glance. */
function AssessmentHistory() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["my-assessment-history"],
    queryFn: listAssessmentHistory,
  });

  return (
    <Card>
      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No completed assessments yet"
        emptyDescription="Assessments you complete will be listed here with their score and result."
      >
        {(items) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Assessment</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Attempt</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const result = resultLabel(item.result, true);
                  return (
                    <tr key={item.attempt_id} className="border-b border-slate-50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">{item.assessment_title}</p>
                        <p className="text-xs text-slate-500">{item.course_title}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {ASSESSMENT_TYPE_LABEL[item.type]}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">#{item.attempt_number}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {item.submitted_at ? formatAssessmentDate(item.submitted_at) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {item.percentage !== null ? formatPercentage(item.percentage) : "—"}
                        {item.score !== null && (
                          <span className="text-xs text-slate-500">
                            {" "}
                            ({item.score}/{item.total_marks})
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {result ? <Badge tone={result.tone}>{result.label}</Badge> : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => void navigate(`/app/assessments/${item.assessment_id}`)}
                        >
                          View Result
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </RemoteDataView>
    </Card>
  );
}

/**
 * Trainee-facing Assessments section: this trainer's own assessments across
 * every course they have effective access to (`GET /assessments`), shown as
 * cards with type, course, dates, derived status, score and result, plus a
 * History tab of every completed attempt (`GET /assessments/history`).
 * Starting, resuming and reviewing all go through the existing, untouched
 * `/app/assessments/:id` (TakeAssessmentPage), which owns attempts, scoring and
 * the per-assessment attempt history — nothing about how attempts are started,
 * graded or limited changes here.
 */
export function AssessmentsPage() {
  const [tab, setTab] = useState<Tab>("CURRENT");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Assessments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Quizzes, mock exams, practical assessments, and tests across your courses.
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-indigo-900 text-indigo-900"
                : "border-transparent text-slate-500 hover:text-indigo-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "CURRENT" ? <CurrentAssessments /> : <AssessmentHistory />}
    </div>
  );
}
