import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

      <div className="flex items-center gap-1.5 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label} <span className="text-xs text-slate-400">({counts[t.key]})</span>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </RemoteDataView>
    </div>
  );
}
