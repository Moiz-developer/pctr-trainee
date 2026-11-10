import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Building2, Tag } from "lucide-react";
import type { CourseCatalogueItem, CourseProgressStatus } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { CourseStatusBadge, ProgressBar } from "../../../components/shared/CourseProgressSummary";
import { getMediaAccessUrl } from "../../../services/api/media";
import { richTextToPlain } from "../../../lib/richText";

const ACTION_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: "Start Course",
  IN_PROGRESS: "Continue",
  COMPLETED: "Review",
};

export const THUMBNAIL_BOX_CLASS =
  "card-slide-section-rtl flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-700 text-white/30";

/**
 * Renders one course's thumbnail. Uses the signed `thumbnailUrl` the
 * catalogue list already carries (batch-signed server-side) when present, so
 * a page of cards needs no per-card request. Falls back to the existing
 * on-demand `["media-access-url", id]` query (as VideoLessonPlayer.tsx uses)
 * when the list had no URL for it, or when that URL fails to load (e.g. it
 * expired while the list sat in the query cache). Shows the branded
 * `BookOpen` placeholder whenever there's no `thumbnailMediaId`, the fetch is
 * still loading, or it fails (a course the caller is otherwise authorized to
 * see should never show a broken image).
 */
function CourseThumbnail({
  thumbnailMediaId,
  thumbnailUrl,
}: {
  thumbnailMediaId: string | null;
  thumbnailUrl: string | null | undefined;
}) {
  const [listUrlFailed, setListUrlFailed] = useState(false);
  const listUrlUsable = !!thumbnailUrl && !listUrlFailed;
  const accessUrlQuery = useQuery({
    queryKey: ["media-access-url", thumbnailMediaId],
    queryFn: () => getMediaAccessUrl(thumbnailMediaId!),
    enabled: !!thumbnailMediaId && !listUrlUsable,
  });

  const src = listUrlUsable
    ? thumbnailUrl
    : thumbnailMediaId
      ? accessUrlQuery.data?.url
      : undefined;

  if (src) {
    return (
      <div className={THUMBNAIL_BOX_CLASS}>
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={listUrlUsable ? () => setListUrlFailed(true) : undefined}
        />
      </div>
    );
  }

  return (
    <div className={THUMBNAIL_BOX_CLASS}>
      <BookOpen className="h-14 w-14" aria-hidden="true" />
    </div>
  );
}

/** Small grey tag chip (the "Presentation / Video / Notes" chips in the reference course cards). */
export function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
      {icon}
      {children}
    </span>
  );
}

/**
 * One course card, shared by CourseCataloguePage.tsx and
 * CompletedCoursesPage.tsx so both render the identical card UI.
 *
 * `showCompletionDate` (Completion Date unit) is opt-in and defaults to
 * unset so CourseCataloguePage.tsx's rendering (including its own
 * in-page "Completed" tab) stays as before — only
 * CompletedCoursesPage.tsx passes it. When set, `course.progress.completed_at`
 * is rendered exactly the way CourseProgressSummary.tsx's own
 * `CourseProgressCard` already displays it ("Completed on <date>",
 * `toLocaleDateString()`). No fallback date: absent `completed_at` renders
 * nothing.
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
    <Card flush className="card-slide-scope flex flex-col">
      <CourseThumbnail
        thumbnailMediaId={course.thumbnail_media_id}
        thumbnailUrl={course.thumbnail_url}
      />

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-semibold leading-snug text-indigo-950">{course.title}</h3>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {richTextToPlain(course.description)}
          </p>
        )}

        <div className="mt-3">
          <CourseStatusBadge status={course.progress.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {course.category && (
            <Chip icon={<Tag className="h-3 w-3" aria-hidden="true" />}>{course.category}</Chip>
          )}
          {/* Department visibility in the Trainer Portal UI unit: the
              department(s) this course is assigned to (empty = globally
              visible — no restriction, so nothing is rendered, same as the
              category chip above when there's no category). */}
          {course.departments.map((department) => (
            <Chip key={department.id} icon={<Building2 className="h-3 w-3" aria-hidden="true" />}>
              {department.name}
            </Chip>
          ))}
        </div>

        <div className="mt-4">
          <ProgressBar label="Progress" pct={course.progress.overall_progress_pct} />
        </div>

        {showCompletionDate && course.progress.completed_at && (
          <p className="mt-2 text-xs text-slate-500">
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
