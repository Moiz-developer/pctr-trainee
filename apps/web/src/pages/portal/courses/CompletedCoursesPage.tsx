import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listUserCourses } from "../../../services/api/userCourses";
import { CourseCard } from "./CourseCard";

/**
 * Trainer Portal "Completed Courses" (dedicated Completed Courses unit).
 * Deliberately reuses the exact same data source, query cache key, and
 * completion test as CourseCataloguePage.tsx's own "Completed" tab —
 * `GET /courses` via `listUserCourses`, filtered to the server-computed
 * `course.progress.status === "COMPLETED"` (course-progress.service.ts's
 * `recomputeCourseProgress` — never re-derived here) — rather than a new
 * endpoint or a second completion rule. Sharing the `["user-courses"]`
 * query key with CourseCataloguePage.tsx means navigating between the two
 * pages reuses one cached fetch instead of refetching, the same
 * dedup-by-shared-key convention already used for `["dashboard"]`
 * (PortalAnnouncementPopup.tsx / UserDashboardPage.tsx). Card rendering
 * (thumbnail, progress bar, View Course action) is `CourseCard.tsx`,
 * shared byte-for-byte with the Catalogue page.
 */
export function CompletedCoursesPage() {
  const query = useQuery({
    queryKey: ["user-courses"],
    queryFn: () => listUserCourses({ pageSize: 100 }),
  });

  const completedCourses = useMemo(
    () => (query.data?.data ?? []).filter((c) => c.progress.status === "COMPLETED"),
    [query.data],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Completed Courses</h2>
        <p className="mt-1 text-sm text-slate-500">Courses you have successfully completed.</p>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data ? completedCourses : undefined}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No completed courses yet"
        emptyDescription="Courses you finish will appear here."
      >
        {(courses) => (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} showCompletionDate />
            ))}
          </div>
        )}
      </RemoteDataView>
    </div>
  );
}
