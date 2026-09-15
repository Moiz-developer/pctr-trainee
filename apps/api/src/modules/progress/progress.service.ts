import type {
  LessonProgressResponse,
  UpdateLessonProgressRequest,
} from "@internal-training/shared";
import { prisma, LONG_TRANSACTION_OPTIONS } from "../../lib/prisma.js";
import type { LessonClassification, LessonProgress } from "../../generated/prisma/client.js";
import { canAccessCourse } from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { recomputeCourseProgress } from "./course-progress.service.js";
import { syncTrainingSessionForLessonProgress } from "../training-hours/training-sessions.service.js";

function toResponse(lessonId: string, row: LessonProgress | null): LessonProgressResponse {
  if (!row) {
    return {
      id: null,
      lesson_id: lessonId,
      status: "NOT_STARTED",
      video_position_seconds: 0,
      started_at: null,
      completed_at: null,
      updated_at: null,
    };
  }
  return {
    id: row.id,
    lesson_id: row.lessonId,
    status: row.status,
    video_position_seconds: row.videoPositionSeconds,
    started_at: row.startedAt ? row.startedAt.toISOString() : null,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Loads a lesson and verifies every precondition a progress operation
 * requires (this unit's spec, items 2-6): the lesson (and its module/course
 * chain) exists, the course is `PUBLISHED`, the module and lesson are both
 * active, and the caller has effective course access. Reuses
 * `canAccessCourse` — the single authoritative resolver
 * (authorization/access.service.ts) — rather than duplicating its logic.
 *
 * Status codes mirror the precedent already established by
 * `getUserCourseDetail` (user-courses.service.ts) for the exact same kind of
 * decision: a lesson id that matches no row at all is 404; a lesson that
 * exists but is currently not in a caller-visible state (course not
 * published, module/lesson retired, or no effective access) is 403 —
 * "exists but not authorized/visible", never a 404-hide, applied
 * consistently down to module/lesson granularity.
 */
async function loadAuthorizedLesson(
  userId: string,
  lessonId: string,
): Promise<{
  courseId: string;
  classification: LessonClassification;
  durationSeconds: number | null;
}> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) {
    // Phase 2H: RLS's own course_lessons_select policy may have hidden this
    // row (inactive lesson/module, unpublished course, or no effective
    // access — the exact same conditions this function's own checks below
    // gate on) — all of those are 403 cases here, not 404 ones (see this
    // function's doc comment). `lesson_exists` returns only a boolean via
    // SECURITY DEFINER, never row content.
    const [row] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.lesson_exists(${lessonId}::uuid) AS exists`;
    if (!row?.exists) {
      throw new NotFoundError(`No lesson exists with id "${lessonId}".`);
    }
    throw new ForbiddenError();
  }

  const { module } = lesson;
  const { course } = module;

  if (course.status !== "PUBLISHED") {
    throw new ForbiddenError();
  }
  if (!module.isActive) {
    throw new ForbiddenError();
  }
  if (!lesson.isActive) {
    throw new ForbiddenError();
  }

  const allowed = await canAccessCourse(userId, course.id);
  if (!allowed) {
    throw new ForbiddenError();
  }

  return {
    courseId: course.id,
    classification: lesson.classification,
    durationSeconds: lesson.durationSeconds,
  };
}

/**
 * GET /api/v1/progress/lessons/:id — the caller's own progress on one
 * lesson. Returns a synthetic NOT_STARTED projection (not 404) when no
 * `lesson_progress` row exists yet — see the shared schema's doc comment.
 */
export async function getLessonProgress(
  userId: string,
  lessonId: string,
): Promise<LessonProgressResponse> {
  await loadAuthorizedLesson(userId, lessonId);

  const row = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  return toResponse(lessonId, row);
}

/**
 * PATCH /api/v1/progress/lessons/:id (SYSTEM_PLAN.md §26/§18): the single
 * mutating endpoint that covers the whole lifecycle — starting a lesson
 * (first call, any body, including empty), resuming/updating video position,
 * and marking complete — via one idempotent upsert keyed on the model's own
 * `@@unique([userId, lessonId])` constraint (Phase 2C), so duplicate rows
 * are structurally impossible, not just discouraged by a pre-check.
 *
 * `userId` always comes from the authenticated request identity (the
 * route), never the request body/params — the actual anti-impersonation
 * mechanism; there is no `user_id` field anywhere in the request contract
 * for a caller to even attempt to supply.
 *
 * Field derivation:
 *   - `status`: client value if supplied, else the existing row's status,
 *     else `IN_PROGRESS` (a first touch with no explicit status IS a start).
 *   - `videoPositionSeconds`: client value if supplied, else the existing
 *     row's value, else 0.
 *   - `startedAt`: set once, on first write, and never overwritten after.
 *   - `completedAt`: set (once) when the resulting status is `COMPLETED`;
 *     cleared if the caller explicitly moves the status away from
 *     `COMPLETED` again, since it should reflect current completion state,
 *     not a sticky historical flag.
 *
 * Phase 3 (§18: "inside the same DB transaction as that write"): the upsert
 * now runs inside `prisma.$transaction(async (tx) => ...)`, together with
 * two reactions to the resulting status transition, neither independently
 * triggered:
 *   1. `syncTrainingSessionForLessonProgress` — opens/closes the
 *      `training_sessions` row that makes this lesson's time count toward
 *      "hours consumed" (§14.3).
 *   2. `recomputeCourseProgress` — recomputes the course's derived
 *      `course_progress` cache (§14.3/§18).
 */
export async function upsertLessonProgress(
  userId: string,
  lessonId: string,
  input: UpdateLessonProgressRequest,
): Promise<LessonProgressResponse> {
  const { courseId, classification, durationSeconds } = await loadAuthorizedLesson(
    userId,
    lessonId,
  );

  return prisma.$transaction(async (tx) => {
    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    const previousStatus = existing?.status ?? "NOT_STARTED";
    const status = input.status ?? existing?.status ?? "IN_PROGRESS";
    const videoPositionSeconds =
      input.video_position_seconds ?? existing?.videoPositionSeconds ?? 0;
    const startedAt = existing?.startedAt ?? new Date();
    const completedAt = status === "COMPLETED" ? (existing?.completedAt ?? new Date()) : null;

    const row = await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { status, videoPositionSeconds, startedAt, completedAt },
      create: { userId, lessonId, status, videoPositionSeconds, startedAt, completedAt },
    });

    await syncTrainingSessionForLessonProgress(tx, {
      userId,
      courseId,
      lessonId,
      classification,
      durationSeconds,
      previousStatus,
      newStatus: status,
    });

    await recomputeCourseProgress(tx, userId, courseId);

    return toResponse(lessonId, row);
  }, LONG_TRANSACTION_OPTIONS);
}
