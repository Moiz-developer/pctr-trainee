import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
import type { CourseStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listCourses } from "../../../services/api/courses";
import { CourseFormModal } from "./CourseFormModal";

const STATUS_TONE: Record<CourseStatus, BadgeTone> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

/**
 * SYSTEM_PLAN.md §33 requires pagination; this unit fetches one page at the
 * API's max page size (100) and filters/searches it client-side — the
 * `status` filter is the one the backend actually supports (Unit 2.2), and
 * a full server-side text search doesn't exist. See this unit's
 * implementation report for why (and the >100-course limitation this implies).
 */
export function AdminCoursesListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "">("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["admin-courses", statusFilter],
    queryFn: () => listCourses({ status: statusFilter || undefined, pageSize: 100 }),
  });

  const filtered = useMemo(() => {
    const items = query.data?.data ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter(
      (course) =>
        course.title.toLowerCase().includes(needle) ||
        (course.category?.name ?? "").toLowerCase().includes(needle),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Courses</h2>
          <p className="mt-1 text-sm text-slate-500">Manage training courses and their content.</p>
        </div>
        <Can permission="course.create">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Course
          </Button>
        </Can>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by title or category…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CourseStatus | "")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={filtered}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No courses found"
          emptyDescription="Create a course to get started, or adjust your filters."
        >
          {(items) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((course) => (
                    <tr
                      key={course.id}
                      onClick={() => void navigate(`/admin/courses/${course.id}`)}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {course.title}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{course.category?.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {course.duration_minutes ? `${course.duration_minutes} min` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[course.status]}>{course.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>
      </Card>

      <CourseFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(course) => void navigate(`/admin/courses/${course.id}`)}
      />
    </div>
  );
}
