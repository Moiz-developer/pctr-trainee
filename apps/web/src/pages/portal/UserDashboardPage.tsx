import type { ReactNode } from "react";
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
import { richTextToPlain } from "../../lib/richText";

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

// A discrete `md:`/`xl:`/`2xl:` breakpoint ladder still jumped straight to a bigger size the
// instant each step fired, regardless of how much width the card actually had at that exact
// viewport — worst of all right at `xl` (1280px), where this dashboard's own two-column split
// (`xl:grid-cols-[minmax(0,1fr)_22rem]` below) simultaneously hands ~22rem of width to the
// "Continue Learning" panel, shrinking these cards at the very moment the font grew. `clamp()`
// scales continuously with the viewport instead: flat at the min below ~1280px, growing smoothly
// through the 1280–1790px range this was reported cramped in, flat at the max from ~1910px up —
// no single width where it's ever "mid-jump". `truncate` stays as the safety net for a value still
// too long at any given width, so it always degrades to a clean single-line ellipsis, never wraps.
const STAT_VALUE_CLASS =
  "mt-2 truncate text-2xl font-bold leading-tight tracking-tight md:text-[clamp(1.25rem,1.57vw,1.875rem)]";

/**
 * A stat tile for this dashboard: the shared StatCard with the icon in a small rounded tile
 * (instead of StatCard's large faint corner glyph). The tile takes the card's own text colour
 * via `currentColor`, so it stays legible when the card's hover fill slides in. Local to this
 * page because StatCard is also used by the admin dashboard.
 *
 * Icon alignment fix: the icon used to be `absolute`-positioned against StatCard's inner content
 * wrapper, which only ever sizes to ITS OWN text — so a card with more text (e.g. "Courses
 * Assigned"'s extra completed/in-progress line) pushed that wrapper taller and the icon lower than
 * the other two cards in the same row (trainer-dashbaord-card.png). Laying the icon out in a
 * `h-full` flex row instead (StatCard's inner wrapper now genuinely fills the grid-stretched card
 * height — see Card.tsx) anchors it to the bottom of the actual card, identically on every card
 * regardless of how much text sits above it. `min-w-0` lets the text side actually shrink/truncate
 * instead of forcing the row wider than the card.
 */
function DashboardStat({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <StatCard className="card-slide-fill-ltr">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-xl bg-current/10 ring-1 ring-current/20"
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      </div>
    </StatCard>
  );
}

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
            <DashboardStat icon={GraduationCap}>
              <p className="text-sm font-medium opacity-90">Trainer ID</p>
              <p className={STAT_VALUE_CLASS}>{identity.data ? identity.data.employeeId : "—"}</p>
            </DashboardStat>
            <DashboardStat icon={Hourglass}>
              <p className="text-sm font-medium opacity-90">Training Hours</p>
              <p className={STAT_VALUE_CLASS}>
                {query.data
                  ? `${query.data.hours.consumed_hours}${
                      query.data.hours.allocated_hours > 0
                        ? ` / ${query.data.hours.allocated_hours}`
                        : ""
                    }h`
                  : "—"}
              </p>
            </DashboardStat>
            <DashboardStat icon={BookOpen}>
              <p className="text-sm font-medium opacity-90">Courses Assigned</p>
              <p className={STAT_VALUE_CLASS}>
                {query.data ? query.data.courses.total_courses : "—"}
              </p>
              {query.data && (
                <p className="mt-1 truncate text-xs opacity-80">
                  {query.data.courses.completed} completed · {query.data.courses.in_progress} in
                  progress
                </p>
              )}
            </DashboardStat>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card>
              <div className="flex items-center gap-3 text-indigo-950">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-900">
                  <BookOpen className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold">Theoretical Training Progress</h3>
              </div>
              <div className="mt-4">
                <ProgressBar
                  label="Overall completion of theoretical chapters."
                  pct={query.data ? query.data.training_progress.theoretical_progress_pct : 0}
                />
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3 text-indigo-950">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-900">
                  <Briefcase className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold">Practical Training Progress</h3>
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
                <Card key={to} flush className="card-slide-scope flex flex-col">
                  <div className="card-slide-section flex h-32 items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/90">
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-current/10 ring-1 ring-current/20">
                      <Icon className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h4 className="text-lg font-semibold leading-snug text-indigo-950">{title}</h4>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">
                      {description}
                    </p>
                    <div className="mt-4">
                      <Button onClick={() => void navigate(to)}>See More</Button>
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
                            {richTextToPlain(item.body)}
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
