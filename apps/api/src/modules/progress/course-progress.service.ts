import type { CourseProgressSummary } from "@internal-training/shared";
import { prisma, type PrismaTransactionClient } from "../../lib/prisma.js";
import type { CourseProgress } from "../../generated/prisma/client.js";

function pct(completed: number, total: number): number {
  // §18: "0% of 0 required lessons" is vacuously complete, not NaN/0% — a
  // course with no required THEORETICAL (or PRACTICAL) lessons has nothing
  // pending in that dimension.
  if (total === 0) return 100;
  return Math.round((completed / total) * 10000) / 100;
}

/**
 * Phase 4: the assessment half of `completion_require_assessment_pass` (see
 * `recomputeCourseProgress`'s doc comment for the exact rule). Only
 * PUBLISHED assessments count — a DRAFT/ARCHIVED assessment is never
 * attemptable by a trainee, mirroring `isActive`-gated lessons. Only GRADED
 * attempts count — a SUBMITTED-but-not-yet-manually-graded attempt has no
 * final `result` yet.
 */
async function userPassesAllPublishedAssessments(
  tx: PrismaTransactionClient,
  userId: string,
  courseId: string,
  minScorePct: number | null,
): Promise<boolean> {
  const assessments = await tx.assessment.findMany({
    where: { courseId, status: "PUBLISHED" },
    select: {
      id: true,
      attempts: {
        where: { userId, status: "GRADED", result: "PASS" },
        select: { percentage: true },
      },
    },
  });

  return assessments.every((assessment) =>
    assessment.attempts.some(
      (attempt) =>
        minScorePct === null ||
        (attempt.percentage !== null && Number(attempt.percentage) >= minScorePct),
    ),
  );
}

/**
 * §14.3/§18: the derived `course_progress` cache. Recomputed by this
 * function inside the SAME DB transaction as the triggering `lesson_progress`
 * write (§18: "inside the same DB transaction as that write") — called only
 * from progress.service.ts's upsertLessonProgress, never from a route
 * handler directly, and never writes lesson_progress itself.
 *
 * Formula (§18, verbatim): theoretical/practical_progress_pct = (required,
 * active lessons of that classification with lesson_progress.status =
 * COMPLETED) / (all required, active lessons of that classification) × 100.
 * overall_progress_pct = simple average of the two (SYSTEM_PLAN.md's own
 * Open Questions section: "Default assumed: simple average, overridable per
 * course later if needed").
 *
 * Completion (status = COMPLETED) reuses the course's own §14.2
 * completion_require_* config rather than a second, duplicated rule:
 *   - completion_require_all_lessons: both theoretical AND practical must
 *     reach 100% (the column's own name is "require ALL lessons" — when
 *     false, no lesson-count threshold is enforced by this clause at all).
 *   - completion_require_practical: practical alone must reach 100%
 *     (relevant when completion_require_all_lessons is false but practical
 *     completion is still mandatory).
 *   - completion_require_assessment_pass (Phase 4 — real check, no longer a
 *     placeholder): every PUBLISHED assessment attached to the course (the
 *     column's name mirrors completion_require_all_lessons's "require ALL"
 *     reading) must have at least one of this user's GRADED attempts with
 *     result = PASS. When completion_min_assessment_score_pct is also set,
 *     that same attempt's percentage must additionally meet it — read as an
 *     override of the assessment's own passing_marks bar specifically for
 *     THIS course's completion purposes (§19 leaves the exact combination
 *     undefined beyond "can reference... together"; this is the literal,
 *     minimal reading, documented here rather than invented ad hoc). A
 *     course with zero PUBLISHED assessments is vacuously satisfied — same
 *     "nothing required, nothing pending" rule as the lesson percentages.
 *
 * This function is called from two places, both after a real fact changes,
 * both inside that same write's own transaction (§18: "inside the same DB
 * transaction as that write"): progress.service.ts's upsertLessonProgress
 * (lesson_progress writes) and assessment-attempts.service.ts's
 * submitAssessmentAttempt/gradeAssessmentAttempt (assessment_attempts
 * writes) — never from a route handler directly, and this function itself
 * never writes lesson_progress or assessment_attempts.
 *
 * Only ever runs after the user has touched this course in some real way,
 * so "the course has been started" is always true by the time it's called —
 * course_progress therefore never itself represents NOT_STARTED as a stored
 * row; NOT_STARTED is the synthetic projection used when no row exists yet
 * (see toCourseProgressSummary below), mirroring lesson_progress's own
 * no-row-means-NOT_STARTED convention.
 */
export async function recomputeCourseProgress(
  tx: PrismaTransactionClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const course = await tx.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      completionRequireAllLessons: true,
      completionRequirePractical: true,
      completionRequireAssessmentPass: true,
      completionMinAssessmentScorePct: true,
    },
  });

  const requiredLessons = await tx.courseLesson.findMany({
    where: {
      isRequired: true,
      isActive: true,
      module: { isActive: true, courseId },
    },
    select: {
      classification: true,
      progress: { where: { userId }, select: { status: true } },
    },
  });

  let theoreticalTotal = 0;
  let theoreticalDone = 0;
  let practicalTotal = 0;
  let practicalDone = 0;
  for (const lesson of requiredLessons) {
    const isDone = lesson.progress[0]?.status === "COMPLETED";
    if (lesson.classification === "THEORETICAL") {
      theoreticalTotal += 1;
      if (isDone) theoreticalDone += 1;
    } else {
      practicalTotal += 1;
      if (isDone) practicalDone += 1;
    }
  }

  const theoreticalProgressPct = pct(theoreticalDone, theoreticalTotal);
  const practicalProgressPct = pct(practicalDone, practicalTotal);
  const overallProgressPct =
    Math.round(((theoreticalProgressPct + practicalProgressPct) / 2) * 100) / 100;

  const meetsLessonRequirement =
    !course.completionRequireAllLessons ||
    (theoreticalProgressPct === 100 && practicalProgressPct === 100);
  const meetsPracticalRequirement =
    !course.completionRequirePractical || practicalProgressPct === 100;
  const meetsAssessmentRequirement = course.completionRequireAssessmentPass
    ? await userPassesAllPublishedAssessments(
        tx,
        userId,
        courseId,
        course.completionMinAssessmentScorePct,
      )
    : true;

  const status: "IN_PROGRESS" | "COMPLETED" =
    meetsLessonRequirement && meetsPracticalRequirement && meetsAssessmentRequirement
      ? "COMPLETED"
      : "IN_PROGRESS";

  const existing = await tx.courseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  const now = new Date();
  const startedAt = existing?.startedAt ?? now;
  const completedAt = status === "COMPLETED" ? (existing?.completedAt ?? now) : null;

  await tx.courseProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {
      theoreticalProgressPct,
      practicalProgressPct,
      overallProgressPct,
      status,
      startedAt,
      completedAt,
      lastRecalculatedAt: now,
    },
    create: {
      userId,
      courseId,
      theoreticalProgressPct,
      practicalProgressPct,
      overallProgressPct,
      status,
      startedAt,
      completedAt,
      lastRecalculatedAt: now,
    },
  });
}

/** The synthetic NOT_STARTED projection for a course with no course_progress row yet (see this file's doc comment). */
const NOT_STARTED_SUMMARY: CourseProgressSummary = {
  status: "NOT_STARTED",
  theoretical_progress_pct: 0,
  practical_progress_pct: 0,
  overall_progress_pct: 0,
  started_at: null,
  completed_at: null,
  last_recalculated_at: null,
};

export function toCourseProgressSummary(
  row: CourseProgress | null | undefined,
): CourseProgressSummary {
  if (!row) return NOT_STARTED_SUMMARY;
  return {
    status: row.status,
    theoretical_progress_pct: Number(row.theoreticalProgressPct),
    practical_progress_pct: Number(row.practicalProgressPct),
    overall_progress_pct: Number(row.overallProgressPct),
    started_at: row.startedAt ? row.startedAt.toISOString() : null,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    last_recalculated_at: row.lastRecalculatedAt.toISOString(),
  };
}

/** Bulk-fetches course_progress for many courses at once (catalogue listing) — avoids an N+1 per row. */
export async function getCourseProgressMap(
  userId: string,
  courseIds: string[],
): Promise<Map<string, CourseProgress>> {
  if (courseIds.length === 0) return new Map();
  const rows = await prisma.courseProgress.findMany({
    where: { userId, courseId: { in: courseIds } },
  });
  return new Map(rows.map((row) => [row.courseId, row]));
}
