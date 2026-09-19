import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Clock } from "lucide-react";
import type {
  CourseDetailAssessment,
  CourseDetailLesson,
  LessonClassification,
  LessonProgressResponse,
} from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { CourseProgressCard } from "../../../components/shared/CourseProgressSummary";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getUserCourseDetail } from "../../../services/api/userCourses";
import { getLessonProgress, updateLessonProgress } from "../../../services/api/lessonProgress";
import { CourseChapterCard } from "./CourseChapterCard";
import { PracticalTaskCard } from "./PracticalTaskCard";
import { LessonViewerModal } from "./LessonViewerModal";
import { isGroupCompleted, type LessonEntry, type ModuleGroup } from "./courseLessonMeta";

type ChapterFilter = "ALL" | "COMPLETED" | "INCOMPLETE";

const CHAPTER_FILTERS: { key: ChapterFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "INCOMPLETE", label: "Incomplete" },
];

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
 * Theory vs Practical is a per-lesson `classification`, not a course type,
 * so one course can hold both. This page therefore renders one section per
 * classification present: theoretical lessons as chapter cards (per
 * theory.png), practical lessons as task cards (per practical.png), each
 * grouped by their module. Opening a lesson is the "open/consume a lesson"
 * action (§18: progress is driven by real interaction, not a separate hidden
 * "start" control) — it calls `PATCH .../progress/lessons/:id` with an empty
 * body the first time a NOT_STARTED lesson is opened. The resulting server
 * response directly replaces that lesson's query-cache entry — the query
 * cache (fed by the API) is the only source of truth for status; no
 * locally-computed "started"/"completed" flag is stored anywhere.
 */
export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>("ALL");

  const courseQuery = useQuery({
    queryKey: ["user-course-detail", id],
    queryFn: () => getUserCourseDetail(id!),
    enabled: !!id,
  });

  const modules = courseQuery.data?.modules ?? [];
  const lessons = modules.flatMap((module) => module.lessons);

  const progressQueries = useQueries({
    queries: lessons.map((lesson) => ({
      queryKey: ["lesson-progress", lesson.id],
      queryFn: () => getLessonProgress(lesson.id),
      enabled: !!courseQuery.data,
    })),
  });

  const progressByLessonId = new Map<string, LessonProgressResponse>();
  const progressIndexByLessonId = new Map<string, number>();
  lessons.forEach((lesson, index) => {
    progressIndexByLessonId.set(lesson.id, index);
    const data = progressQueries[index]?.data;
    if (data) progressByLessonId.set(lesson.id, data);
  });

  // The next lesson the trainee hasn't completed yet — a plain per-lesson-status
  // navigation aid, not a course-level completion percentage (explicitly out of
  // scope until course_progress exists).
  const currentLessonId =
    lessons.find(
      (lesson) => (progressByLessonId.get(lesson.id)?.status ?? "NOT_STARTED") !== "COMPLETED",
    )?.id ?? null;

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
      toast.error(error instanceof ApiClientError ? error.message : "Failed to start this lesson.");
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

  function buildEntry(lesson: CourseDetailLesson): LessonEntry {
    const index = progressIndexByLessonId.get(lesson.id);
    return {
      lesson,
      status: progressByLessonId.get(lesson.id)?.status ?? "NOT_STARTED",
      loading:
        (index !== undefined && !!progressQueries[index]?.isLoading) ||
        (startMutation.isPending && startMutation.variables === lesson.id),
      isCurrent: lesson.id === currentLessonId,
    };
  }

  function buildGroups(classification: LessonClassification): ModuleGroup[] {
    return modules
      .map((module) => ({
        moduleId: module.id,
        title: module.title,
        description: module.description,
        entries: module.lessons
          .filter((lesson) => lesson.classification === classification)
          .map(buildEntry),
      }))
      .filter((group) => group.entries.length > 0);
  }

  function handleOpenLesson(lessonId: string) {
    setOpenLessonId(lessonId);
    const current = progressByLessonId.get(lessonId);
    if (!current || current.status === "NOT_STARTED") {
      startMutation.mutate(lessonId);
    }
  }

  const theoryGroups = buildGroups("THEORETICAL");
  const practicalGroups = buildGroups("PRACTICAL");
  const progressReady = progressQueries.every((query) => !query.isLoading);
  const completedChapters = theoryGroups.filter(isGroupCompleted).length;
  const visibleChapters = theoryGroups.filter((group) =>
    chapterFilter === "ALL"
      ? true
      : chapterFilter === "COMPLETED"
        ? isGroupCompleted(group)
        : !isGroupCompleted(group),
  );

  // The chapter/task card the open lesson belongs to — the lesson view lists its sibling files.
  const openGroup =
    [...theoryGroups, ...practicalGroups].find((group) =>
      group.entries.some((e) => e.lesson.id === openLessonId),
    ) ?? null;
  const openIndex = openLessonId ? progressIndexByLessonId.get(openLessonId) : undefined;
  const openProgressQuery = openIndex !== undefined ? progressQueries[openIndex] : undefined;

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

            {theoryGroups.length === 0 && practicalGroups.length === 0 && (
              <Card>
                <p className="py-6 text-center text-sm text-slate-500">
                  Content for this course hasn&apos;t been added yet.
                </p>
              </Card>
            )}

            {theoryGroups.length > 0 && (
              <section aria-labelledby="theory-heading" className="space-y-5">
                <h3 id="theory-heading" className="text-lg font-semibold text-indigo-950">
                  Theoretical Training Chapters
                </h3>

                <Card>
                  <h4 className="text-lg font-semibold text-indigo-950">Chapter Progress</h4>
                  {progressReady && (
                    <>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        Completed {completedChapters} out of {theoryGroups.length} chapters
                      </p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className="h-full rounded-full bg-indigo-900"
                          style={{
                            width: `${Math.round((completedChapters / theoryGroups.length) * 100)}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </Card>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-sm font-semibold text-indigo-950">Filter:</span>
                  {CHAPTER_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setChapterFilter(filter.key)}
                      className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                        chapterFilter === filter.key
                          ? "border-indigo-900 bg-indigo-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-indigo-900 hover:text-indigo-900"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {visibleChapters.length === 0 ? (
                  <Card>
                    <p className="py-6 text-center text-sm text-slate-500">
                      No chapters match this filter.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {visibleChapters.map((group) => (
                      <CourseChapterCard
                        key={group.moduleId}
                        group={group}
                        onOpenLesson={handleOpenLesson}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {practicalGroups.length > 0 && (
              <section aria-labelledby="practical-heading" className="space-y-5">
                <h3 id="practical-heading" className="text-lg font-semibold text-indigo-950">
                  Practical Training
                </h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {practicalGroups.map((group) => (
                    <PracticalTaskCard
                      key={group.moduleId}
                      group={group}
                      onOpenLesson={handleOpenLesson}
                    />
                  ))}
                </div>
              </section>
            )}

            <AssessmentsSection assessments={course.assessments} />
          </>
        )}
      </RemoteDataView>

      <LessonViewerModal
        group={openGroup}
        openLessonId={openLessonId}
        progress={openLessonId ? progressByLessonId.get(openLessonId) : undefined}
        progressError={openProgressQuery?.isError ? openProgressQuery.error : null}
        isCompleting={completeMutation.isPending && completeMutation.variables === openLessonId}
        onSelectLesson={handleOpenLesson}
        onComplete={(lessonId) => completeMutation.mutate(lessonId)}
        onRetryProgress={() => void openProgressQuery?.refetch()}
        onClose={() => setOpenLessonId(null)}
      />
    </div>
  );
}
