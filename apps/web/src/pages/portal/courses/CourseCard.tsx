import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock } from "lucide-react";
import type { CourseCatalogueItem, CourseProgressStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { CourseProgressInline } from "../../../components/shared/CourseProgressSummary";
import { getMediaAccessUrl } from "../../../services/api/media";

const ACTION_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: "Start Course",
  IN_PROGRESS: "Continue",
  COMPLETED: "Review",
};

const THUMBNAIL_BOX_CLASS =
  "flex h-32 items-center justify-center overflow-hidden rounded-lg bg-indigo-50 text-indigo-300";

/**
 * Resolves and renders one course's thumbnail on demand via the existing
 * signed-URL flow, mirroring VideoLessonPlayer.tsx's own
 * `["media-access-url", id]` query exactly — no new media architecture.
 * Falls back to the original `BookOpen` placeholder box whenever there's no
 * `thumbnailMediaId`, the fetch is still loading, or it fails (a course the
 * caller is otherwise authorized to see should never show a broken image).
 */
function CourseThumbnail({ thumbnailMediaId }: { thumbnailMediaId: string | null }) {
  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", thumbnailMediaId],
    queryFn: () => getMediaAccessUrl(thumbnailMediaId!),
    enabled: !!thumbnailMediaId,
  });

  if (thumbnailMediaId && accessUrlQuery.data) {
    return (
      <div className={THUMBNAIL_BOX_CLASS}>
        <img src={accessUrlQuery.data.url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={THUMBNAIL_BOX_CLASS}>
      <BookOpen className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

/**
 * One course card — the exact rendering CourseCataloguePage.tsx originally
 * inlined, extracted unchanged so CompletedCoursesPage.tsx (Completed
 * Courses unit) can reuse the identical card UI/primitives rather than a
 * second, independently-maintained copy. Behavior/markup is byte-for-byte
 * the same as before this extraction.
 *
 * `showCompletionDate` (Completion Date unit) is opt-in and defaults to
 * unset so CourseCataloguePage.tsx's rendering (including its own
 * in-page "Completed" tab) stays pixel-identical to before — only
 * CompletedCoursesPage.tsx passes it. When set, `course.progress.completed_at`
 * is rendered exactly the way CourseProgressSummary.tsx's own
 * `CourseProgressCard` already displays it ("Completed on <date>",
 * `toLocaleDateString()`) — the project's existing convention for this
 * exact field, reused rather than reinvented. No fallback date: absent
 * `completed_at` renders nothing.
 */
export function CourseCard({
  course,
  showCompletionDate,
}: {
  course: CourseCatalogueItem;
  showCompletionDate?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col">
      <CourseThumbnail thumbnailMediaId={course.thumbnail_media_id} />

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{course.title}</h3>
          <Badge tone="success">Published</Badge>
        </div>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{course.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {course.category && <Badge tone="neutral">{course.category}</Badge>}
          {/* Department visibility in the Trainer Portal UI unit: the
              department(s) this course is assigned to (empty = globally
              visible — no restriction, so nothing is rendered, same as the
              category badge above when there's no category). */}
          {course.departments.map((department) => (
            <Badge key={department.id} tone="info">
              {department.name}
            </Badge>
          ))}
          {course.duration_minutes !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {course.duration_minutes} min
            </span>
          )}
        </div>

        <div className="mt-3">
          <CourseProgressInline progress={course.progress} />
        </div>

        {showCompletionDate && course.progress.completed_at && (
          <p className="mt-1 text-xs text-slate-500">
            Completed on {new Date(course.progress.completed_at).toLocaleDateString()}
          </p>
        )}

        <div className="mt-4 flex-1" />
        <Button className="w-full" onClick={() => void navigate(`/app/courses/${course.id}`)}>
          {ACTION_LABEL[course.progress.status]}
        </Button>
      </div>
    </Card>
  );
}
