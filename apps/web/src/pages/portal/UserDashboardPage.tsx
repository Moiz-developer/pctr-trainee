import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  FileText,
  GraduationCap,
  Hourglass,
  MessageSquare,
  Paperclip,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, StatCard } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
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

// Quick Access tiles — shortcuts to portal routes that already exist (same
// destinations as the sidebar); purely navigational.
const QUICK_ACCESS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    to: "/app/courses",
    title: "Course Catalogue",
    description: "Browse the courses available to you and continue your training.",
    icon: BookOpen,
  },
  {
    to: "/app/assessments",
    title: "Assessments",
    description: "Take assessments and review your attempts and results.",
    icon: ClipboardList,
  },
  {
    to: "/app/resources",
    title: "Resources",
    description: "Reference documents and files made available to you.",
    icon: FileText,
  },
  {
    to: "/app/queries",
    title: "Query",
    description: "Ask the training team a question and follow the conversation.",
    icon: MessageSquare,
  },
];

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

  const unreadAnnouncements = query.data
    ? query.data.announcements.filter((a) => !a.read_state.is_read).length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Welcome{identity.data ? `, ${identity.data.fullName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Continue your training below.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatCard icon={GraduationCap}>
              <p className="text-xs">Trainer ID</p>
              <p className="mt-2 truncate text-2xl font-bold sm:text-3xl">
                {identity.data ? identity.data.employeeId : "—"}
              </p>
            </StatCard>
            <StatCard icon={Hourglass}>
              <p className="text-xs">Training Hours</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {query.data
                  ? `${query.data.hours.consumed_hours}${
                      query.data.hours.allocated_hours > 0
                        ? ` / ${query.data.hours.allocated_hours}`
                        : ""
                    }h`
                  : "—"}
              </p>
            </StatCard>
            <StatCard icon={BookOpen}>
              <p className="text-xs">Courses Assigned</p>
              <p className="mt-2 text-2xl font-bold sm:text-3xl">
                {query.data ? query.data.courses.total_courses : "—"}
              </p>
              {query.data && (
                <p className="mt-1 text-xs opacity-80">
                  {query.data.courses.completed} completed · {query.data.courses.in_progress} in
                  progress
                </p>
              )}
            </StatCard>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2 text-indigo-950">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Theoretical Training Progress</h3>
              </div>
              <div className="mt-4">
                <ProgressBar
                  label="Overall completion of theoretical chapters."
                  pct={query.data ? query.data.training_progress.theoretical_progress_pct : 0}
                />
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-indigo-950">
                <Briefcase className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Practical Training Progress</h3>
              </div>
              <div className="mt-4">
                <ProgressBar
                  label="Overall completion of practical tasks."
                  pct={query.data ? query.data.training_progress.practical_progress_pct : 0}
                />
              </div>
            </Card>
          </div>

          <section>
            <h3 className="mb-3 text-xl font-semibold text-indigo-900">Quick Access</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-4">
              {QUICK_ACCESS.map(({ to, title, description, icon: Icon }) => (
                <Card key={to} flush className="flex flex-col">
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30">
                    <Icon className="h-14 w-14" aria-hidden="true" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h4 className="flex items-center gap-2 text-base font-semibold text-indigo-950">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {title}
                    </h4>
                    <p className="mt-1.5 flex-1 text-xs text-slate-500">{description}</p>
                    <div className="mt-4">
                      <Button className="px-3 py-1.5 text-xs" onClick={() => void navigate(to)}>
                        See More
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <Card flush>
          <CardHeader title="Continue Learning" />
          <div className="max-h-[34rem] overflow-y-auto p-4">
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
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li key={item.course_id}>
                      <button
                        type="button"
                        onClick={() => void navigate(`/app/courses/${item.course_id}`)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 px-2 py-3 text-left transition-colors hover:bg-indigo-50/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {item.course_title}
                          </span>
                          <span className="mt-2 block">
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
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Theoretical {item.theoretical_progress_pct}% · Practical{" "}
                            {item.practical_progress_pct}%
                          </span>
                        </span>
                        <span className="shrink-0 rounded bg-indigo-900 px-3 py-1.5 text-xs font-medium text-white">
                          Continue
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </RemoteDataView>
          </div>
        </Card>
      </div>

      <Card flush>
        <CardHeader
          title="Important Announcements"
          action={
            <div className="flex items-center gap-3">
              {unreadAnnouncements > 0 && (
                <Badge tone="danger" solid>
                  {unreadAnnouncements} unread
                </Badge>
              )}
              <button
                type="button"
                onClick={() => void navigate("/app/announcements")}
                className="cursor-pointer text-xs font-medium text-indigo-800 hover:underline"
              >
                View all
              </button>
            </div>
          }
        />
        <div className="p-6">
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
                {items.map((item, index) => {
                  const unread = !item.read_state.is_read;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void navigate("/app/announcements")}
                        className="flex w-full cursor-pointer items-start gap-4 rounded-lg p-3 text-left transition-colors hover:bg-indigo-50/50"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-900 text-xs font-semibold text-white">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            {unread && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-indigo-600"
                                aria-label="Unread"
                              />
                            )}
                            <span
                              className={`truncate text-sm ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                            >
                              {item.title}
                            </span>
                            <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                            {(item.attachment_media_id || item.image_media_id) && (
                              <Paperclip
                                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                aria-label="Has attachment"
                              />
                            )}
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.body}
                          </span>
                          {item.published_at && (
                            <span className="mt-1 block text-xs text-slate-400">
                              {new Date(item.published_at).toLocaleString()}
                            </span>
                          )}
                        </span>
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
  );
}
