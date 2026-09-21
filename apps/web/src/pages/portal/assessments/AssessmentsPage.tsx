import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AssessmentType, MyAssessmentSummary } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import {
  listAssessmentHistory,
  listOwnAssessments,
} from "../../../services/api/assessmentAttempts";
import { AssessmentSummaryCard } from "./AssessmentSummaryCard";
import {
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

const TYPE_ICON: Record<AssessmentType, LucideIcon> = {
  QUIZ: CircleHelp,
  MOCK_EXAM: FileCheck2,
  PRACTICAL: Wrench,
  TEST: ClipboardCheck,
  OTHER: ClipboardList,
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

// The reference's bottom status pill for a finished assessment, coloured by its real result.
const DONE_PILL_CLASS = {
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warning: "bg-amber-500",
} as const;

function AssessmentCard({ assessment, now }: { assessment: MyAssessmentSummary; now: number }) {
  const navigate = useNavigate();
  const TypeIcon = TYPE_ICON[assessment.type];
  const done = assessment.my_status === "COMPLETED";
  const result = resultLabel(assessment.my_best_result, assessment.my_last_submitted_at !== null);
  const overdue =
    assessment.due_date !== null && !done && new Date(assessment.due_date).getTime() < now;
  const open = () => void navigate(`/app/assessments/${assessment.id}`);

  const progressLine =
    assessment.my_best_score !== null
      ? `${assessment.my_best_score} / ${assessment.total_marks} marks${
          assessment.my_best_percentage !== null
            ? ` (${formatPercentage(assessment.my_best_percentage)})`
            : ""
        }`
      : assessment.my_status === "IN_PROGRESS"
        ? "Attempt in progress"
        : "Not attempted yet";

  return (
    <Card flush className="card-slide-scope flex flex-col">
      <div className="p-5 pb-3">
        <h3 className="min-h-10 text-sm font-semibold leading-snug text-indigo-950">
          {assessment.title}
        </h3>
        <p className="mt-3 text-center text-xs font-semibold text-slate-700">
          {assessment.question_count} {assessment.question_count === 1 ? "Question" : "Questions"}
        </p>
        <p className="mt-2 line-clamp-2 min-h-8 text-center text-xs text-slate-500">
          {assessment.description ?? assessment.course_title}
        </p>
      </div>

      <div className="card-slide-section-rtl mx-5 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30">
        <TypeIcon className="h-12 w-12" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-5 pt-3">
        <p className="text-center text-xs font-semibold text-slate-700">{progressLine}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <Badge tone="info">{ASSESSMENT_TYPE_LABEL[assessment.type]}</Badge>
          <span className="text-xs text-slate-500">{assessment.course_title}</span>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Assigned {formatAssessmentDate(assessment.assigned_at)}
          {assessment.due_date && (
            <>
              {" · "}
              <span className={overdue ? "font-medium text-red-600" : undefined}>
                Due {formatAssessmentDate(assessment.due_date)}
                {overdue ? " (overdue)" : ""}
              </span>
            </>
          )}
        </p>
        {!done && result && (
          <p className="mt-1 text-center text-xs text-slate-500">Best result: {result.label}</p>
        )}

        <div className="mt-4 flex-1" />
        {done ? (
          <div className="space-y-2">
            <Button type="button" className="w-full text-xs" onClick={open}>
              View Details
            </Button>
            <p
              className={`rounded-md px-3 py-2 text-center text-xs font-semibold text-white ${
                DONE_PILL_CLASS[result?.tone ?? "success"]
              }`}
            >
              Completed{result ? ` · ${result.label}` : ""}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={open}
              className="cursor-pointer rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-400"
            >
              {assessment.my_status === "IN_PROGRESS" ? "Continue" : "Start Assessment"}
            </button>
            <Button type="button" className="text-xs" onClick={open}>
              View Details
            </Button>
          </div>
        )}
      </div>
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
      {all.length > 0 && <AssessmentSummaryCard assessments={all} />}

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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
 * every course they have effective access to (`GET /assessments`), as a summary
 * card (overall progress, current score, per-assessment table) over a grid of
 * assessment cards, plus a History tab of every completed attempt
 * (`GET /assessments/history`). Starting, continuing and reviewing all go
 * through the existing `/app/assessments/:id` (TakeAssessmentPage), which owns
 * attempts, scoring and per-assessment attempt history — nothing about how
 * attempts are started, graded or limited changes here.
 */
export function AssessmentsPage() {
  const [tab, setTab] = useState<Tab>("CURRENT");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Assessments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Test your knowledge and track your progress across quizzes, mock exams, practical
          assessments, and tests.
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
