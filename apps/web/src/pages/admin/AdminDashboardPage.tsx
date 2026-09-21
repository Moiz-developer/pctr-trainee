import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Megaphone, TrendingUp } from "lucide-react";
import type { AnnouncementPriority } from "@internal-training/shared";
import { Card, StatCard } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { RemoteDataView } from "../../components/shared/RemoteDataView";
import { useAuth } from "../../auth/useAuth";
import { listUsers } from "../../services/api/users";
import { getCourseProgressSummary } from "../../services/api/courses";
import { listAdminQueries } from "../../services/api/adminQueries";
import { listAdminAnnouncements } from "../../services/api/adminAnnouncements";
import { richTextToPlain } from "../../lib/richText";

const PRIORITY_TONE: Record<AnnouncementPriority, BadgeTone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "danger",
};

/**
 * Admin Dashboard (SYSTEM_PLAN.md §40) — replaces the Phase-1 placeholder
 * shell with real, server-computed figures, each reusing an existing
 * admin list/service exactly as-is (no duplicated business logic):
 *   - Active Trainees: `GET /admin/users?status=ACTIVE&pageSize=1`'s
 *     `meta.totalItems` (the existing admin user list, with a `status`
 *     filter widened onto it the same way courses/announcements/queries
 *     already support one).
 *   - Courses In Progress: `GET /admin/courses/progress-summary` — the one
 *     genuinely new read added by this unit, since no existing endpoint
 *     exposed `course_progress` admin-wide (only per-trainee, via
 *     `GET /dashboard`); it's a single `count()` against the same
 *     `course_progress` table, no new business logic.
 *   - Open Queries: `GET /admin/queries?status=OPEN&pageSize=1`'s
 *     `meta.totalItems` — the existing Admin Query Queue endpoint, already
 *     filterable by status.
 *   - Important Announcements: `GET /admin/announcements?status=PUBLISHED&
 *     priority=HIGH` — the existing Admin Announcement list, the same
 *     service AdminAnnouncementsPage.tsx already uses.
 * Each figure is `query.data ? value : "—"` while loading/erroring — the
 * same graceful-degradation convention UserDashboardPage.tsx's own stat
 * cards already use, never a fabricated placeholder number.
 */
export function AdminDashboardPage() {
  const { identity } = useAuth();
  const navigate = useNavigate();

  const activeTraineesQuery = useQuery({
    queryKey: ["admin-dashboard-active-trainees"],
    queryFn: () => listUsers({ status: "ACTIVE", pageSize: 1 }),
  });

  const coursesInProgressQuery = useQuery({
    queryKey: ["admin-dashboard-courses-in-progress"],
    queryFn: getCourseProgressSummary,
  });

  const openQueriesQuery = useQuery({
    queryKey: ["admin-dashboard-open-queries"],
    queryFn: () => listAdminQueries({ status: "OPEN", pageSize: 1 }),
  });

  const announcementsQuery = useQuery({
    queryKey: ["admin-dashboard-announcements"],
    queryFn: () => listAdminAnnouncements({ status: "PUBLISHED", priority: "HIGH", pageSize: 5 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Welcome{identity.data ? `, ${identity.data.fullName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Here's an overview of the training platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard icon={TrendingUp} className="card-slide-fill-ltr">
          <p className="text-xs">Active Trainees</p>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {activeTraineesQuery.data ? activeTraineesQuery.data.meta.totalItems : "—"}
          </p>
        </StatCard>
        <StatCard icon={Activity} className="card-slide-fill-ltr">
          <p className="text-xs">Courses In Progress</p>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {coursesInProgressQuery.data ? coursesInProgressQuery.data.in_progress_count : "—"}
          </p>
        </StatCard>
        <StatCard icon={Megaphone} className="card-slide-fill-ltr">
          <p className="text-xs">Open Queries</p>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {openQueriesQuery.data ? openQueriesQuery.data.meta.totalItems : "—"}
          </p>
        </StatCard>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Important Announcements</h3>
          <button
            type="button"
            onClick={() => void navigate("/admin/announcements")}
            className="cursor-pointer text-xs font-medium text-indigo-700 hover:underline"
          >
            View all
          </button>
        </div>
        <div className="mt-3">
          <RemoteDataView
            isLoading={announcementsQuery.isLoading}
            isError={announcementsQuery.isError}
            error={announcementsQuery.error}
            data={announcementsQuery.data?.data}
            onRetry={() => void announcementsQuery.refetch()}
            isEmpty={(items) => items.length === 0}
            emptyTitle="No important announcements"
            emptyDescription="Published, high-priority announcements will appear here."
          >
            {(items) => (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void navigate("/admin/announcements")}
                      className="w-full cursor-pointer rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                        <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {richTextToPlain(item.body)}
                      </p>
                      {item.published_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(item.published_at).toLocaleString()}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </RemoteDataView>
        </div>
      </Card>
    </div>
  );
}
