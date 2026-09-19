import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  File,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Presentation,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CourseLessonResponse, LessonContentType } from "@internal-training/shared";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listCourseLessons, updateCourseLesson } from "../../../services/api/courseLessons";
import { LessonFormModal } from "./LessonFormModal";
import { LessonMediaModal } from "./LessonMediaModal";

const MEDIA_BACKED_TYPES = new Set(["VIDEO", "PDF", "DOCUMENT", "PRESENTATION"]);

/**
 * Visual distinction between lesson content types unit: an icon + a
 * human-readable label per `LessonContentType`, mirroring
 * CourseDetailPage.tsx's identical `CONTENT_TYPE_META`/`ContentTypeBadge`
 * addition for the trainee-facing lesson list. Purely presentational.
 */
const CONTENT_TYPE_META: Record<LessonContentType, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: "Video", icon: Video },
  PDF: { label: "PDF", icon: FileText },
  DOCUMENT: { label: "Document", icon: File },
  PRESENTATION: { label: "Presentation", icon: Presentation },
  EXTERNAL_LINK: { label: "External Link", icon: ExternalLink },
  TEXT: { label: "Text", icon: AlignLeft },
};

/** Lessons within one module — mirrors CourseModulesPanel's reorder/retire pattern one level down. */
export function LessonsPanel({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formState, setFormState] = useState<{ open: boolean; lesson?: CourseLessonResponse }>({
    open: false,
  });
  const [mediaLesson, setMediaLesson] = useState<CourseLessonResponse | null>(null);
  const [retireTarget, setRetireTarget] = useState<CourseLessonResponse | null>(null);

  const query = useQuery({
    queryKey: ["course-lessons", moduleId],
    queryFn: () => listCourseLessons(courseId, moduleId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course-lessons", moduleId] });

  const onMutationError = (error: unknown) => {
    toast.error(error instanceof ApiClientError ? error.message : "Something went wrong.");
  };

  const toggleActive = useMutation({
    mutationFn: (lesson: CourseLessonResponse) =>
      updateCourseLesson(courseId, moduleId, lesson.id, { is_active: !lesson.is_active }),
    onSuccess: (_data, lesson) => {
      invalidate();
      toast.success(lesson.is_active ? "Lesson retired." : "Lesson reactivated.");
    },
    onError: onMutationError,
  });

  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: CourseLessonResponse; b: CourseLessonResponse }) =>
      Promise.all([
        updateCourseLesson(courseId, moduleId, a.id, { sort_order: b.sort_order }),
        updateCourseLesson(courseId, moduleId, b.id, { sort_order: a.sort_order }),
      ]),
    onSuccess: invalidate,
    onError: onMutationError,
  });

  function move(lessons: CourseLessonResponse[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;
    reorder.mutate({ a: lessons[index]!, b: lessons[target]! });
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lessons</h4>
        <Button
          type="button"
          variant="secondary"
          className="gap-1 px-3 py-1.5 text-xs"
          onClick={() => setFormState({ open: true })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Lesson
        </Button>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No lessons yet"
      >
        {(lessons) => (
          <ul className="space-y-2">
            {lessons.map((lesson, index) => {
              const contentTypeMeta = CONTENT_TYPE_META[lesson.content_type];
              const ContentTypeIcon = contentTypeMeta.icon;
              return (
              <li
                key={lesson.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ContentTypeIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{lesson.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="info">
                        <ContentTypeIcon className="mr-1 h-3 w-3" aria-hidden="true" />
                        {contentTypeMeta.label}
                      </Badge>
                      <Badge tone="neutral">{lesson.classification}</Badge>
                      {lesson.is_required && <Badge tone="warning">Required</Badge>}
                      <Badge tone={lesson.is_active ? "success" : "neutral"}>
                        {lesson.is_active ? "Active" : "Retired"}
                      </Badge>
                      {MEDIA_BACKED_TYPES.has(lesson.content_type) && (
                        <Badge tone={lesson.media_asset_id ? "success" : "neutral"}>
                          {lesson.media_asset_id ? "Media attached" : "No media"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(lessons, index, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    disabled={index === lessons.length - 1 || reorder.isPending}
                    onClick={() => move(lessons, index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {MEDIA_BACKED_TYPES.has(lesson.content_type) && (
                    <button
                      type="button"
                      className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      onClick={() => setMediaLesson(lesson)}
                      aria-label="Manage media"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setFormState({ open: true, lesson })}
                    aria-label="Edit lesson"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Button
                    type="button"
                    variant={lesson.is_active ? "secondary" : "primary"}
                    className="px-2 py-1 text-xs"
                    onClick={() =>
                      lesson.is_active ? setRetireTarget(lesson) : toggleActive.mutate(lesson)
                    }
                  >
                    {lesson.is_active ? "Retire" : "Reactivate"}
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </RemoteDataView>

      <LessonFormModal
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        courseId={courseId}
        moduleId={moduleId}
        lesson={formState.lesson}
        nextSortOrder={(query.data?.length ?? 0) + 1}
      />
      {mediaLesson && (
        <LessonMediaModal
          open={!!mediaLesson}
          onClose={() => setMediaLesson(null)}
          courseId={courseId}
          moduleId={moduleId}
          lesson={mediaLesson}
        />
      )}
      <ConfirmDialog
        open={!!retireTarget}
        title="Retire lesson"
        description={`"${retireTarget?.title}" will be hidden from trainees but its record is kept (never deleted). You can reactivate it later.`}
        confirmLabel="Retire"
        isPending={toggleActive.isPending}
        onCancel={() => setRetireTarget(null)}
        onConfirm={() => {
          if (retireTarget) toggleActive.mutate(retireTarget);
          setRetireTarget(null);
        }}
      />
    </div>
  );
}
