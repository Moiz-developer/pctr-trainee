import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Megaphone, Paperclip } from "lucide-react";
import { Card, StatCard } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { RemoteDataView } from "../../components/shared/RemoteDataView";
import { CourseProgressInline, ProgressBar } from "../../components/shared/CourseProgressSummary";
import { useAuth } from "../../auth/useAuth";
import { getDashboard } from "../../services/api/dashboard";
import type { AnnouncementPriority } from "@internal-training/shared";

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * User Dashboard (SYSTEM_PLAN.md §26/§40 Phase 3: "dashboard real data
 * (hours, progress, continue learning)"; §26: "aggregates hours, progress,
 * announcements, continue-learning"). Every figure below comes from
 * `GET /dashboard` (dashboard.service.ts) — server-computed, never a
 * client-side estimate or hardcoded value. `announcements` (Phase 5.3.6)
 * fills in what was previously this page's own Phase-1 placeholder — the
 * same server-visibility-filtered, read-state-aware list `GET /announcements`
 * itself returns, just capped to the top 5 (announcements.service.ts's
 * `listDashboardAnnouncements`).
 */
export function UserDashboardPage() {
  const { identity } = useAuth();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Welcome{identity.data ? `, ${identity.data.fullName}` : ""}
        </h2>
        {identity.data && (
          <p className="mt-1 text-xs text-slate-500">Trainer ID: {identity.data.employeeId}</p>
        )}
        <p className="mt-1 text-sm text-slate-500">Continue your training below.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard>
          <Clock className="h-5 w-5 opacity-80" aria-hidden="true" />
          <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Training Hours</p>
          <p className="mt-1 text-2xl font-bold">
            {query.data
              ? `${query.data.hours.consumed_hours}${
                  query.data.hours.allocated_hours > 0
                    ? ` / ${query.data.hours.allocated_hours}`
                    : ""
                }h`
              : "—"}
          </p>
        </StatCard>
        <StatCard>
          <BookOpen className="h-5 w-5 opacity-80" aria-hidden="true" />
          <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Courses Assigned</p>
          <p className="mt-1 text-2xl font-bold">
            {query.data ? query.data.courses.total_courses : "—"}
          </p>
          {query.data && (
            <p className="mt-1 text-xs opacity-70">
              {query.data.courses.completed} completed · {query.data.courses.in_progress} in
              progress
            </p>
          )}
        </StatCard>
        <StatCard>
          <Megaphone className="h-5 w-5 opacity-80" aria-hidden="true" />
          <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Important Announcements</p>
          <p className="mt-1 text-2xl font-bold">
            {query.data ? query.data.announcements.length : "—"}
          </p>
          {query.data && (
            <p className="mt-1 text-xs opacity-70">
              {query.data.announcements.filter((a) => !a.read_state.is_read).length} unread
            </p>
          )}
        </StatCard>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900">Training Progress</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProgressBar
            label="Theoretical"
            pct={query.data ? query.data.training_progress.theoretical_progress_pct : 0}
          />
          <ProgressBar
            label="Practical"
            pct={query.data ? query.data.training_progress.practical_progress_pct : 0}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900">Continue Learning</h3>
          <div className="mt-3">
            <RemoteDataView
              isLoading={query.isLoading}
              isError={query.isError}
              error={query.error}
              data={query.data?.continue_learning}
              onRetry={() => void query.refetch()}
              isEmpty={(items) => items.length === 0}
              emptyTitle="No courses in progress"
              emptyDescription="Start a course from the catalogue to see it here."
            >
              {(items) => (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.course_id}>
                      <button
                        type="button"
                        onClick={() => void navigate(`/app/courses/${item.course_id}`)}
                        className="w-full cursor-pointer rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.course_title}
                        </p>
                        <div className="mt-2">
                          <CourseProgressInline
                            progress={{
                              status: item.status,
                              overall_progress_pct: item.overall_progress_pct,
                              theoretical_progress_pct: item.theoretical_progress_pct,
                              practical_progress_pct: item.practical_progress_pct,
                              started_at: null,
                              completed_at: null,
                              last_recalculated_at: item.last_recalculated_at,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Theoretical {item.theoretical_progress_pct}% · Practical{" "}
                          {item.practical_progress_pct}%
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </RemoteDataView>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Important Announcements</h3>
            <button
              type="button"
              onClick={() => void navigate("/app/announcements")}
              className="cursor-pointer text-xs font-medium text-indigo-700 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-3">
            <RemoteDataView
              isLoading={query.isLoading}
              isError={query.isError}
              error={query.error}
              data={query.data?.announcements}
              onRetry={() => void query.refetch()}
              isEmpty={(items) => items.length === 0}
              emptyTitle="No important announcements"
              emptyDescription="Published important announcements will appear here."
            >
              {(items) => (
                <ul className="space-y-3">
                  {items.map((item) => {
                    const unread = !item.read_state.is_read;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void navigate("/app/announcements")}
                          className="w-full cursor-pointer rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                        >
                          <div className="flex items-center gap-2">
                            {unread && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-indigo-600"
                                aria-label="Unread"
                              />
                            )}
                            <p
                              className={`truncate text-sm ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                            >
                              {item.title}
                            </p>
                            <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                            {(item.attachment_media_id || item.image_media_id) && (
                              <Paperclip
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-label="Has attachment"
                              />
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                          {item.published_at && (
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(item.published_at).toLocaleString()}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RemoteDataView>
          </div>
        </Card>
      </div>
    </div>
  );
}
