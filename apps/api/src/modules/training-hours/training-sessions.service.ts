import type { LessonClassification, TrainingType } from "../../generated/prisma/client.js";
import type { PrismaTransactionClient } from "../../lib/prisma.js";

type LessonProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

/**
 * §14.3: `training_sessions` is the "hours consumed" ledger. No direct
 * create/update API exists for it anywhere in SYSTEM_PLAN.md — it is
 * auto-tracked from the only existing "user is training" signal,
 * `lesson_progress` transitions, to avoid inventing a parallel tracking API
 * or duplicating progress logic. Called only from progress.service.ts's
 * upsertLessonProgress, inside the same transaction as the lesson_progress
 * write it reacts to.
 *
 * `LessonClassification` (THEORETICAL/PRACTICAL) is a strict subset of
 * `TrainingType` (which also has ASSESSMENT/OTHER for future phases) — every
 * lesson-driven session is typed by the lesson's own classification.
 */
export async function syncTrainingSessionForLessonProgress(
  tx: PrismaTransactionClient,
  params: {
    userId: string;
    courseId: string;
    lessonId: string;
    classification: LessonClassification;
    durationSeconds: number | null;
    previousStatus: LessonProgressStatus;
    newStatus: LessonProgressStatus;
  },
): Promise<void> {
  const { userId, courseId, lessonId, classification, durationSeconds, previousStatus, newStatus } =
    params;

  // No status transition (e.g. a video-position-only PATCH while already
  // IN_PROGRESS) — the existing ACTIVE session, if any, is untouched.
  if (previousStatus === newStatus) return;

  const trainingType: TrainingType = classification;
  const startingNow = previousStatus === "NOT_STARTED";
  const completingNow = newStatus === "COMPLETED" && previousStatus !== "COMPLETED";

  if (!completingNow) {
    if (startingNow && newStatus === "IN_PROGRESS") {
      await tx.trainingSession.create({
        data: {
          userId,
          courseId,
          lessonId,
          trainingType,
          startedAt: new Date(),
          status: "ACTIVE",
        },
      });
    }
    // A backward transition (COMPLETED -> IN_PROGRESS) is not currently
    // reachable via the API contract (updateLessonProgressRequestSchema
    // accepts no NOT_STARTED target, and no "reopen" flow exists), so no
    // training_session handling is defined for it here.
    return;
  }

  // Completing now: start + complete can happen in the very same PATCH call
  // (e.g. Phase 2F's video-threshold auto-complete on a lesson never
  // previously touched) — in that case there is no pre-existing ACTIVE
  // session to close, so one is created already-closed.
  if (startingNow) {
    const now = new Date();
    const durationMinutes = Math.max(1, Math.round((durationSeconds ?? 60) / 60));
    await tx.trainingSession.create({
      data: {
        userId,
        courseId,
        lessonId,
        trainingType,
        startedAt: now,
        endedAt: now,
        durationMinutes,
        status: "COMPLETED",
      },
    });
    return;
  }

  const active = await tx.trainingSession.findFirst({
    where: { userId, lessonId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });
  // No active session to close (e.g. a redundant re-PATCH of an
  // already-completed lesson) — idempotent, no duplicate hours counted.
  if (!active) return;

  const now = new Date();
  const elapsedSeconds = Math.max(
    0,
    Math.round((now.getTime() - active.startedAt.getTime()) / 1000),
  );
  const durationMinutes = Math.max(1, Math.round((durationSeconds ?? elapsedSeconds) / 60));
  await tx.trainingSession.update({
    where: { id: active.id },
    data: { status: "COMPLETED", endedAt: now, durationMinutes },
  });
}

/**
 * Phase 4: `training_sessions` tracking for assessment attempts. Unlike
 * `syncTrainingSessionForLessonProgress` (which has to guess elapsed time
 * across separate PATCH calls, so it opens an ACTIVE row on start and closes
 * it later), an `assessment_attempts` row already carries its own
 * authoritative `started_at` set at attempt creation — so this writes one
 * already-COMPLETED session directly at submit time, using the attempt's
 * own timestamps, rather than needing to find-and-close a matching ACTIVE
 * row (which would be ambiguous if a user had concurrent in-progress
 * attempts across different assessments in the same course). Called only
 * from assessment-attempts.service.ts's submitAssessmentAttempt, inside the
 * same transaction as the attempt's submit write. Time-on-task is recorded
 * regardless of whether grading is still pending (manual questions) —
 * elapsed time doesn't change based on when grading happens.
 */
export async function recordTrainingSessionForAssessmentAttempt(
  tx: PrismaTransactionClient,
  params: {
    userId: string;
    courseId: string;
    startedAt: Date;
    submittedAt: Date;
  },
): Promise<void> {
  const { userId, courseId, startedAt, submittedAt } = params;
  const elapsedSeconds = Math.max(
    0,
    Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  await tx.trainingSession.create({
    data: {
      userId,
      courseId,
      lessonId: null,
      trainingType: "ASSESSMENT",
      startedAt,
      endedAt: submittedAt,
      durationMinutes,
      status: "COMPLETED",
    },
  });
}
