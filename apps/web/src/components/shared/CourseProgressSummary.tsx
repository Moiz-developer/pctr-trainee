import type { CourseProgressSummary as CourseProgressSummaryData } from "@internal-training/shared";
import { Card } from "../ui/Card";
import { Badge, type BadgeTone } from "../ui/Badge";

const STATUS_LABEL: Record<CourseProgressSummaryData["status"], string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const STATUS_TONE: Record<CourseProgressSummaryData["status"], BadgeTone> = {
  NOT_STARTED: "danger",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

/** Filled status pill for course cards (reference designs' "Completed"/"Incompleted" pills). */
export function CourseStatusBadge({ status }: { status: CourseProgressSummaryData["status"] }) {
  return (
    <Badge tone={STATUS_TONE[status]} solid>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Exported so UserDashboardPage.tsx can reuse the exact same bar for its aggregate Theoretical/Practical Training Progress section, rather than duplicating this markup. */
export function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span className="text-indigo-900">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-indigo-900"}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Renders the caller's own real `course_progress` (SYSTEM_PLAN.md §14.3/§18)
 * — always server-computed data embedded in the course catalogue/detail
 * response, never a client-side estimate. Used by CourseDetailPage (full
 * card) and CourseCataloguePage (compact inline variant).
 */
export function CourseProgressCard({ progress }: { progress: CourseProgressSummaryData }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-indigo-950">Your Progress</h3>
        <Badge tone={STATUS_TONE[progress.status]} solid>
          {STATUS_LABEL[progress.status]}
        </Badge>
      </div>
      <div className="space-y-3">
        <ProgressBar label="Overall" pct={progress.overall_progress_pct} />
        <ProgressBar label="Theoretical" pct={progress.theoretical_progress_pct} />
        <ProgressBar label="Practical" pct={progress.practical_progress_pct} />
      </div>
      {progress.completed_at && (
        <p className="mt-3 text-xs text-slate-500">
          Completed on {new Date(progress.completed_at).toLocaleDateString()}
        </p>
      )}
    </Card>
  );
}

/** Compact single-line variant — a progress bar + percentage, for list rows (CourseCataloguePage). */
export function CourseProgressInline({ progress }: { progress: CourseProgressSummaryData }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={`h-full rounded-full ${
            progress.overall_progress_pct >= 100 ? "bg-emerald-500" : "bg-indigo-900"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress.overall_progress_pct))}%` }}
        />
      </div>
      <Badge tone={STATUS_TONE[progress.status]}>{STATUS_LABEL[progress.status]}</Badge>
    </div>
  );
}
