import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listUserCourses } from "../../../services/api/userCourses";
import { CourseCard } from "./CourseCard";

type FilterTab = "ALL" | "IN_PROGRESS" | "COMPLETED";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
];

/**
 * SYSTEM_PLAN.md §25/§26: the API (`GET /courses`, Unit 2.7) already
 * returns only PUBLISHED courses the authenticated user has effective
 * access to (department membership OR explicit grant) — this page fetches
 * and renders that response as-is; it never filters or decides access
 * itself. Card rendering (including thumbnail resolution) lives in
 * `CourseCard.tsx`, shared with `CompletedCoursesPage.tsx` (Completed
 * Courses unit) so both pages render the identical card UI rather than two
 * copies.
 *
 * Phase 3: each course's `progress` (course_progress, server-computed —
 * never fabricated client-side) drives the inline progress bar/status badge
 * and the In Progress/Completed tabs below. This in-page "Completed" tab
 * stays exactly as it was — a convenience filter over this same
 * already-fetched list — independent of the new dedicated
 * `/app/courses/completed` page, which reuses the same
 * `progress.status === "COMPLETED"` filter and the same `["user-courses"]`
 * query/cache instead of a second endpoint.
 */
export function CourseCataloguePage() {
  const [tab, setTab] = useState<FilterTab>("ALL");
  const query = useQuery({
    queryKey: ["user-courses"],
    queryFn: () => listUserCourses({ pageSize: 100 }),
  });

  const allCourses = useMemo(() => query.data?.data ?? [], [query.data]);
  const counts = useMemo(
    () => ({
      ALL: allCourses.length,
      IN_PROGRESS: allCourses.filter((c) => c.progress.status === "IN_PROGRESS").length,
      COMPLETED: allCourses.filter((c) => c.progress.status === "COMPLETED").length,
    }),
    [allCourses],
  );
  const filteredCourses = useMemo(
    () => (tab === "ALL" ? allCourses : allCourses.filter((c) => c.progress.status === tab)),
    [allCourses, tab],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Course Catalogue</h2>
        <p className="mt-1 text-sm text-slate-500">Courses available to you.</p>
      </div>

      {query.data && counts.ALL > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-indigo-950">Your Progress</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            Completed {counts.COMPLETED} out of {counts.ALL} courses
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-indigo-900"
              style={{ width: `${Math.round((counts.COMPLETED / counts.ALL) * 100)}%` }}
            />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm font-semibold text-indigo-950">Filter:</span>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "border-indigo-900 bg-indigo-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-indigo-900 hover:text-indigo-900"
            }`}
          >
            {t.label} <span className="opacity-70">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data ? filteredCourses : undefined}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle={tab === "ALL" ? "No courses available yet" : "No courses in this view yet"}
        emptyDescription={
          tab === "ALL"
            ? "Courses assigned to your department, or granted to you directly, will appear here."
            : "Courses will appear here once their progress matches this filter."
        }
      >
        {(courses) => (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </RemoteDataView>
    </div>
  );
}
