import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AlignLeft,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  ExternalLink,
  File,
  FileText,
  Folder,
  Loader2,
  PlayCircle,
  Presentation,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  CourseDetailAssessment,
  CourseDetailLesson,
  LessonContentType,
  LessonProgressResponse,
  LessonProgressStatus,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { CourseProgressCard } from "../../../components/shared/CourseProgressSummary";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getUserCourseDetail } from "../../../services/api/userCourses";
import { getLessonProgress, updateLessonProgress } from "../../../services/api/lessonProgress";
import { VideoLessonPlayer } from "./VideoLessonPlayer";
import { PdfLessonViewer } from "./PdfLessonViewer";
import { DocumentLessonViewer } from "./DocumentLessonViewer";
import { ExternalVideoPlayer, getEmbeddableVideoUrl } from "./ExternalVideoPlayer";
import { PresentationLessonViewer } from "./PresentationLessonViewer";

const STATUS_LABEL: Record<LessonProgressStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const STATUS_TONE: Record<LessonProgressStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

/**
 * Visual distinction between lesson content types unit: an icon + a
 * human-readable label per `LessonContentType`, replacing the raw enum
 * value (e.g. "EXTERNAL_LINK") the content-type Badge used to show
 * verbatim. Purely presentational — content types/behavior are unchanged.
 */
const CONTENT_TYPE_META: Record<LessonContentType, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: "Video", icon: Video },
  PDF: { label: "PDF", icon: FileText },
  DOCUMENT: { label: "Document", icon: File },
  PRESENTATION: { label: "Presentation", icon: Presentation },
  EXTERNAL_LINK: { label: "External Link", icon: ExternalLink },
  TEXT: { label: "Text", icon: AlignLeft },
};

function ContentTypeBadge({ contentType }: { contentType: LessonContentType }) {
  const { label, icon: Icon } = CONTENT_TYPE_META[contentType];
  return (
    <Badge tone="info">
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function StatusIcon({ status, loading }: { status: LessonProgressStatus; loading?: boolean }) {
  if (loading) {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-300" aria-hidden="true" />;
  }
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />;
  }
  if (status === "IN_PROGRESS") {
    return <PlayCircle className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />;
}

/**
 * Renders a lesson's actual content for the two content types that have
 * always just been inline data (TEXT/EXTERNAL_LINK). VIDEO/PDF/DOCUMENT/
 * PRESENTATION each have their own dedicated player/viewer component
 * (rendered directly by the caller below, not through this function) — see
 * VideoLessonPlayer.tsx, PdfLessonViewer.tsx, DocumentLessonViewer.tsx,
 * PresentationLessonViewer.tsx.
 */
function LessonContent({ lesson }: { lesson: CourseDetailLesson }) {
  if (lesson.content_type === "TEXT") {
    return (
      <p className="whitespace-pre-wrap text-sm text-slate-700">
        {lesson.text_content ?? "This lesson has no content yet."}
      </p>
    );
  }
  if (lesson.content_type === "EXTERNAL_LINK" && lesson.external_url) {
    // External video playback unit: a recognized YouTube/Vimeo link renders
    // as an embedded player (ExternalVideoPlayer.tsx); anything else keeps
    // the existing plain "Open Resource" link, unchanged.
    const embedUrl = getEmbeddableVideoUrl(lesson.external_url);
    if (embedUrl) {
      return <ExternalVideoPlayer embedUrl={embedUrl} title={lesson.title} />;
    }
    return (
      <a
        href={lesson.external_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline"
      >
        Open Resource
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    );
  }
  return (
    <p className="text-sm text-slate-400">This lesson has no content yet.</p>
  );
}

/**
 * Phase 4: the course's PUBLISHED assessments (embedded in `GET
 * /courses/:id`, §14.4/§19) with this trainee's own attempt-budget/result.
 * Navigates to the dedicated take/review flow (TakeAssessmentPage) rather
 * than rendering questions inline here — an assessment attempt is its own
 * focused flow, unlike a lesson's inline expand/collapse.
 */
function AssessmentsSection({ assessments }: { assessments: CourseDetailAssessment[] }) {
  const navigate = useNavigate();
  if (assessments.length === 0) return null;

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Assessments</h3>
      <ul className="space-y-2">
        {assessments.map((assessment) => {
          const attemptsExhausted = assessment.my_attempts_used >= assessment.max_attempts;
          const actionLabel =
            assessment.my_best_result === "PASS"
              ? "Review"
              : attemptsExhausted
                ? "View Result"
                : assessment.my_attempts_used > 0
                  ? "Retry"
                  : "Start Assessment";
          return (
            <li
              key={assessment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{assessment.title}</p>
                  <p className="text-xs text-slate-500">
                    {assessment.passing_marks}/{assessment.total_marks} to pass ·{" "}
                    {assessment.my_attempts_used}/{assessment.max_attempts} attempts used
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {assessment.my_best_result && (
                  <Badge tone={assessment.my_best_result === "PASS" ? "success" : "warning"}>
                    {assessment.my_best_result}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant={
                    attemptsExhausted && assessment.my_best_result !== "PASS"
                      ? "secondary"
                      : "primary"
                  }
                  className="px-3 py-1.5 text-xs"
                  disabled={attemptsExhausted && assessment.my_best_result === null}
                  onClick={() => void navigate(`/app/assessments/${assessment.id}`)}
                >
                  {actionLabel}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * User Course Detail / Lesson Viewer (SYSTEM_PLAN.md §18/§26 `GET
 * /courses/:id`, `PATCH /progress/lessons/:id`). Course/module/lesson
 * structure still comes from Unit 2.7's `GET /courses/:id`, unmodified.
 * Every lesson's status shown here comes from a real, per-lesson
 * `GET /progress/lessons/:id` call (Unit 2D) — there is no bulk "course
 * progress" endpoint (that's the explicitly out-of-scope `course_progress`
 * derived cache), so each lesson's progress is fetched independently via
 * `useQueries`, exactly mirroring what a real client would need to do
 * against the actual API surface that exists today.
 *
 * Expanding a lesson is the "open/consume a lesson" action (§18: progress
 * is driven by real interaction, not a separate hidden "start" control) —
 * it calls `PATCH .../progress/lessons/:id` with an empty body the first
 * time a NOT_STARTED lesson is opened. The resulting server response
 * directly replaces that lesson's query-cache entry — the query cache (fed
 * by the API) is the only source of truth for status; no locally-computed
 * "started"/"completed" flag exists anywhere in this component.
 */
export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ["user-course-detail", id],
    queryFn: () => getUserCourseDetail(id!),
    enabled: !!id,
  });

  const lessons = useMemo(
    () => courseQuery.data?.modules.flatMap((module) => module.lessons) ?? [],
    [courseQuery.data],
  );

  const progressQueries = useQueries({
    queries: lessons.map((lesson) => ({
      queryKey: ["lesson-progress", lesson.id],
      queryFn: () => getLessonProgress(lesson.id),
      enabled: !!courseQuery.data,
    })),
  });

  const progressByLessonId = useMemo(() => {
    const map = new Map<string, LessonProgressResponse>();
    lessons.forEach((lesson, index) => {
      const data = progressQueries[index]?.data;
      if (data) map.set(lesson.id, data);
    });
    return map;
  }, [lessons, progressQueries]);

  // The next lesson the trainee hasn't completed yet — a plain per-lesson-status
  // navigation aid, not a course-level completion percentage (explicitly out of
  // scope until course_progress exists).
  const currentLessonId = useMemo(() => {
    const next = lessons.find(
      (lesson) => (progressByLessonId.get(lesson.id)?.status ?? "NOT_STARTED") !== "COMPLETED",
    );
    return next?.id ?? null;
  }, [lessons, progressByLessonId]);

  const startMutation = useMutation({
    mutationFn: (lessonId: string) => updateLessonProgress(lessonId, {}),
    onSuccess: (data, lessonId) => {
      queryClient.setQueryData(["lesson-progress", lessonId], data);
      // The server recomputes course_progress in the same transaction as
      // this write (§18) — refetch the course detail (which embeds it) so
      // the progress bar below reflects the new state, not a stale one.
      void queryClient.invalidateQueries({ queryKey: ["user-course-detail", id] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to start this lesson.",
      );
    },
  });

  const completeMutation = useMutation({
    mutationFn: (lessonId: string) => updateLessonProgress(lessonId, { status: "COMPLETED" }),
    onSuccess: (data, lessonId) => {
      queryClient.setQueryData(["lesson-progress", lessonId], data);
      void queryClient.invalidateQueries({ queryKey: ["user-course-detail", id] });
      toast.success("Lesson marked complete.");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to mark this lesson complete.",
      );
    },
  });

  function handleToggleLesson(lesson: CourseDetailLesson) {
    const isExpanding = expandedLessonId !== lesson.id;
    setExpandedLessonId(isExpanding ? lesson.id : null);
    if (isExpanding) {
      const current = progressByLessonId.get(lesson.id);
      if (!current || current.status === "NOT_STARTED") {
        startMutation.mutate(lesson.id);
      }
    }
  }

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/app/courses")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Catalogue
      </button>

      <RemoteDataView
        isLoading={courseQuery.isLoading}
        isError={courseQuery.isError}
        error={courseQuery.error}
        data={courseQuery.data}
        onRetry={() => void courseQuery.refetch()}
      >
        {(course) => (
          <>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{course.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                {course.category && <Badge tone="neutral">{course.category}</Badge>}
                {course.duration_minutes !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {course.duration_minutes} min
                  </span>
                )}
              </div>
              {course.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                  {course.description}
                </p>
              )}
            </div>

            <CourseProgressCard progress={course.progress} />

            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Course Content</h3>
              {course.modules.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Content for this course hasn't been added yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {course.modules.map((module) => (
                    <li key={module.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-slate-900">{module.title}</p>
                      </div>
                      {module.description && (
                        <p className="mt-1 pl-6 text-xs text-slate-500">{module.description}</p>
                      )}
                      {module.lessons.length > 0 && (
                        <ul className="mt-2 space-y-2 pl-6">
                          {module.lessons.map((lesson) => {
                            const progressIndex = lessons.findIndex((l) => l.id === lesson.id);
                            const progressResult = progressQueries[progressIndex];
                            const status =
                              progressByLessonId.get(lesson.id)?.status ?? "NOT_STARTED";
                            const isCurrent = lesson.id === currentLessonId;
                            const isExpanded = expandedLessonId === lesson.id;
                            const isStarting =
                              startMutation.isPending && startMutation.variables === lesson.id;
                            const isCompleting =
                              completeMutation.isPending &&
                              completeMutation.variables === lesson.id;
                            const completedAt = progressByLessonId.get(lesson.id)?.completed_at;

                            return (
                              <li
                                key={lesson.id}
                                className={`rounded-lg border p-3 ${
                                  isCurrent
                                    ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                                    : "border-slate-200"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleLesson(lesson)}
                                  className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <StatusIcon
                                      status={status}
                                      loading={progressResult?.isLoading || isStarting}
                                    />
                                    <span className="truncate text-sm text-slate-800">
                                      {lesson.title}
                                    </span>
                                    {isCurrent && <Badge tone="info">Continue here</Badge>}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                    <ContentTypeBadge contentType={lesson.content_type} />
                                    <Badge tone={lesson.is_required ? "warning" : "neutral"}>
                                      {lesson.is_required ? "Required" : "Optional"}
                                    </Badge>
                                    <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                                  </div>
                                </button>

                                {progressResult?.isError && (
                                  <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                                    <AlertTriangle
                                      className="h-3.5 w-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {progressResult.error instanceof ApiClientError
                                      ? progressResult.error.message
                                      : "Couldn't load progress for this lesson."}
                                    <button
                                      type="button"
                                      className="cursor-pointer font-medium underline"
                                      onClick={() => void progressResult.refetch()}
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="mt-3 border-t border-slate-100 pt-3">
                                    {lesson.content_type === "VIDEO" ? (
                                      lesson.media_asset_id ? (
                                        progressByLessonId.get(lesson.id) ? (
                                          <VideoLessonPlayer
                                            lessonId={lesson.id}
                                            mediaAssetId={lesson.media_asset_id}
                                            authoritativeDurationSeconds={lesson.duration_seconds}
                                            progress={progressByLessonId.get(lesson.id)!}
                                          />
                                        ) : (
                                          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                                            <Loader2
                                              className="h-4 w-4 animate-spin"
                                              aria-hidden="true"
                                            />
                                            Loading…
                                          </div>
                                        )
                                      ) : (
                                        <p className="text-sm text-slate-400">
                                          This lesson's video hasn't been uploaded yet.
                                        </p>
                                      )
                                    ) : lesson.content_type === "PDF" ? (
                                      lesson.media_asset_id ? (
                                        <PdfLessonViewer mediaAssetId={lesson.media_asset_id} />
                                      ) : (
                                        <p className="text-sm text-slate-400">
                                          This lesson's PDF hasn't been uploaded yet.
                                        </p>
                                      )
                                    ) : lesson.content_type === "DOCUMENT" ? (
                                      lesson.media_asset_id ? (
                                        <DocumentLessonViewer
                                          mediaAssetId={lesson.media_asset_id}
                                          mimeType={lesson.media_mime_type}
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-400">
                                          This lesson's document hasn't been uploaded yet.
                                        </p>
                                      )
                                    ) : lesson.content_type === "PRESENTATION" ? (
                                      lesson.media_asset_id ? (
                                        <PresentationLessonViewer
                                          mediaAssetId={lesson.media_asset_id}
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-400">
                                          This lesson's presentation hasn't been uploaded yet.
                                        </p>
                                      )
                                    ) : (
                                      <LessonContent lesson={lesson} />
                                    )}

                                    {/*
                                      VIDEO lessons never get the manual button — per
                                      SYSTEM_PLAN.md §18, video completion is driven by
                                      watch-through percentage (VideoLessonPlayer, above),
                                      not a user action. The "Completed" confirmation still
                                      applies uniformly once that auto-completion lands.
                                    */}
                                    {lesson.content_type !== "VIDEO" && (
                                      <div className="mt-3 flex items-center gap-3">
                                        {status !== "COMPLETED" ? (
                                          <Button
                                            type="button"
                                            variant="primary"
                                            className="gap-1.5 px-3 py-1.5 text-xs"
                                            disabled={isCompleting}
                                            onClick={() => completeMutation.mutate(lesson.id)}
                                          >
                                            {isCompleting ? (
                                              <Loader2
                                                className="h-3.5 w-3.5 animate-spin"
                                                aria-hidden="true"
                                              />
                                            ) : (
                                              <CheckCircle2
                                                className="h-3.5 w-3.5"
                                                aria-hidden="true"
                                              />
                                            )}
                                            Mark Complete
                                          </Button>
                                        ) : (
                                          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                            <CheckCircle2
                                              className="h-3.5 w-3.5"
                                              aria-hidden="true"
                                            />
                                            Completed
                                            {completedAt
                                              ? ` on ${new Date(completedAt).toLocaleDateString()}`
                                              : ""}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {lesson.content_type === "VIDEO" && status === "COMPLETED" && (
                                      <div className="mt-3 flex items-center gap-3">
                                        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                          <CheckCircle2
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                          />
                                          Completed
                                          {completedAt
                                            ? ` on ${new Date(completedAt).toLocaleDateString()}`
                                            : ""}
                                        </p>
                                      </div>
                                    )}

                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <AssessmentsSection assessments={course.assessments} />
          </>
        )}
      </RemoteDataView>
    </div>
  );
}
