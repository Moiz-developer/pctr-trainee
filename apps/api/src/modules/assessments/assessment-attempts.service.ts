import type {
  AssessmentDetail,
  AssessmentAttemptResponse,
  SubmitAssessmentAttemptRequest,
  PaginationMeta,
  MyAssessmentSummary,
  MyAssessmentHistoryItem,
} from "@internal-training/shared";
import { prisma, LONG_TRANSACTION_OPTIONS } from "../../lib/prisma.js";
import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentQuestionOption,
} from "../../generated/prisma/client.js";
import { canAccessCourse, effectiveCourseAccessFilter } from "../authorization/access.service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.js";
import { recomputeCourseProgress } from "../progress/course-progress.service.js";
import { recordTrainingSessionForAssessmentAttempt } from "../training-hours/training-sessions.service.js";

type QuestionWithOptions = AssessmentQuestion & { options: AssessmentQuestionOption[] };
type AssessmentWithQuestions = Assessment & { questions: QuestionWithOptions[] };
type AttemptWithAnswers = AssessmentAttempt & { answers: AssessmentAnswer[] };

// §14.4: only these three question types are option-backed and therefore
// mechanically auto-gradable by comparing the recorded selected_option_id
// against assessment_question_options.is_correct. Per this schema's own
// field shape (assessment_answers.selected_option_id is a single nullable
// FK, not a multi-value set — §14.4's literal field list, not an omission
// by this implementation), a MULTIPLE_CHOICE question is graded the same
// way as SINGLE_CHOICE: correctness of the one recorded selection. No
// multi-select answer mechanism is invented beyond what the schema stores.
const AUTO_GRADABLE_TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]);

/**
 * "Best" = PASS beats FAIL beats a still-PENDING attempt; null only when no
 * attempt exists at all. Shared by getAssessmentDetail (below) and
 * user-courses.service.ts's course-detail assessment summary, so the two
 * embeddings of "this user's standing on this assessment" can never drift.
 */
export function computeBestAssessmentResult(
  attempts: { result: "PENDING" | "PASS" | "FAIL" }[],
): "PENDING" | "PASS" | "FAIL" | null {
  if (attempts.some((a) => a.result === "PASS")) return "PASS";
  if (attempts.some((a) => a.result === "FAIL")) return "FAIL";
  return attempts.length > 0 ? "PENDING" : null;
}

/**
 * Loads an assessment and verifies every precondition an attempt operation
 * requires, mirroring progress.service.ts's loadAuthorizedLesson exactly:
 * the assessment must exist, be PUBLISHED, and the caller must have
 * effective access to its parent course. A DRAFT/ARCHIVED assessment, or a
 * PUBLISHED one the caller can't access, is 403 (exists but not visible) —
 * only a genuinely nonexistent id is 404 (§26/§31's established rule).
 */
async function loadAuthorizedAssessment(
  userId: string,
  assessmentId: string,
): Promise<AssessmentWithQuestions> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { include: { options: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!assessment) {
    throw new NotFoundError(`No assessment exists with id "${assessmentId}".`);
  }
  if (assessment.status !== "PUBLISHED") {
    throw new ForbiddenError();
  }
  const allowed = await canAccessCourse(userId, assessment.courseId);
  if (!allowed) {
    throw new ForbiddenError();
  }
  return assessment;
}

function toAnswerResponse(answer: AssessmentAnswer) {
  return {
    question_id: answer.questionId,
    selected_option_id: answer.selectedOptionId,
    answer_text: answer.answerText,
    is_correct: answer.isCorrect,
    marks_awarded: answer.marksAwarded !== null ? Number(answer.marksAwarded) : null,
  };
}

function toAttemptResponse(attempt: AttemptWithAnswers): AssessmentAttemptResponse {
  return {
    id: attempt.id,
    assessment_id: attempt.assessmentId,
    attempt_number: attempt.attemptNumber,
    started_at: attempt.startedAt.toISOString(),
    submitted_at: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    score: attempt.score !== null ? Number(attempt.score) : null,
    percentage: attempt.percentage !== null ? Number(attempt.percentage) : null,
    result: attempt.result,
    status: attempt.status,
    answers: attempt.answers.map(toAnswerResponse),
  };
}

/**
 * GET /api/v1/assessments/:id (SYSTEM_PLAN.md §19: "the client never
 * receives correct answers before submission") — strips `is_correct` from
 * every option, unlike the admin authoring view (assessments.service.ts).
 * `my_attempts_used`/`my_best_result` are derived from the caller's own
 * attempts only — never another user's, matching this table's self-only RLS.
 */
export async function getAssessmentDetail(
  userId: string,
  assessmentId: string,
): Promise<AssessmentDetail> {
  const assessment = await loadAuthorizedAssessment(userId, assessmentId);

  const myAttempts = await prisma.assessmentAttempt.findMany({
    where: { assessmentId, userId },
    select: { result: true },
  });
  const bestResult = computeBestAssessmentResult(myAttempts);

  return {
    id: assessment.id,
    course_id: assessment.courseId,
    title: assessment.title,
    description: assessment.description,
    type: assessment.type,
    total_marks: assessment.totalMarks,
    passing_marks: assessment.passingMarks,
    duration_minutes: assessment.durationMinutes,
    due_date: assessment.dueDate ? assessment.dueDate.toISOString() : null,
    max_attempts: assessment.maxAttempts,
    my_attempts_used: myAttempts.length,
    my_attempts_remaining: Math.max(0, assessment.maxAttempts - myAttempts.length),
    my_best_result: bestResult,
    questions: assessment.questions.map((q) => ({
      id: q.id,
      question_text: q.questionText,
      question_type: q.questionType,
      marks: q.marks,
      sort_order: q.sortOrder,
      options: q.options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => ({ id: o.id, option_text: o.optionText, sort_order: o.sortOrder })),
    })),
  };
}

/**
 * POST /api/v1/assessments/:id/attempts (SYSTEM_PLAN.md §26/§19).
 * `attempt_number` is server-assigned from the caller's own existing attempt
 * count, never client-supplied (§19: "to prevent replay/tampering"). An
 * existing IN_PROGRESS attempt is returned as-is rather than starting a
 * second one — an accidental double-click/resume shouldn't consume an
 * additional attempt slot.
 */
export async function startAssessmentAttempt(
  userId: string,
  assessmentId: string,
): Promise<AssessmentAttemptResponse> {
  const assessment = await loadAuthorizedAssessment(userId, assessmentId);

  const existing = await prisma.assessmentAttempt.findMany({
    where: { assessmentId, userId },
    include: { answers: true },
    orderBy: { attemptNumber: "desc" },
  });

  const inProgress = existing.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return toAttemptResponse(inProgress);
  }

  if (existing.length >= assessment.maxAttempts) {
    throw new ForbiddenError(
      `No attempts remaining for this assessment (max_attempts: ${assessment.maxAttempts}).`,
    );
  }

  try {
    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId,
        userId,
        attemptNumber: existing.length + 1,
        startedAt: new Date(),
        status: "IN_PROGRESS",
        result: "PENDING",
      },
      include: { answers: true },
    });
    return toAttemptResponse(attempt);
  } catch {
    // Concurrent double-start race on the (assessmentId, userId, attemptNumber) unique constraint.
    throw new ConflictError("An attempt was already started for this assessment.");
  }
}

async function findOwnedAttempt(userId: string, attemptId: string): Promise<AttemptWithAnswers> {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt) {
    throw new NotFoundError(`No attempt exists with id "${attemptId}".`);
  }
  if (attempt.userId !== userId) {
    throw new ForbiddenError();
  }
  return attempt;
}

/**
 * GET /api/v1/assessments (Assessments unit) — this caller's own PUBLISHED
 * assessments across every course they have effective access to. Uses the
 * exact same `effectiveCourseAccessFilter` predicate the catalogue/dashboard
 * already build their course sets from (SYSTEM_PLAN.md §6) as a nested
 * `course` filter on `Assessment`, rather than first listing accessible
 * courses and then querying assessments per course (avoids an N+1 and a
 * second, independently-maintained "which courses can this user see" step).
 * `my_attempts_used`/`my_best_result` reuse `computeBestAssessmentResult`
 * exactly as `getUserCourseDetail`'s own per-course assessment embedding
 * does (user-courses.service.ts) — no second completion/result rule.
 */
export async function listOwnAssessments(
  userId: string,
): Promise<{ items: MyAssessmentSummary[]; meta: PaginationMeta }> {
  const rows = await prisma.assessment.findMany({
    where: {
      status: "PUBLISHED",
      course: { status: "PUBLISHED", ...effectiveCourseAccessFilter(userId) },
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      totalMarks: true,
      passingMarks: true,
      maxAttempts: true,
      dueDate: true,
      createdAt: true,
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        select: {
          status: true,
          result: true,
          score: true,
          percentage: true,
          submittedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const items: MyAssessmentSummary[] = rows.map((assessment) => {
    // Completed = submitted (auto-graded) or graded; an EXPIRED/IN_PROGRESS attempt has no result to show.
    const completed = assessment.attempts.filter(
      (a) => a.status === "SUBMITTED" || a.status === "GRADED",
    );
    // The best attempt by percentage (which is also the passing one whenever any attempt passed).
    const best = completed
      .filter((a) => a.percentage !== null)
      .sort((a, b) => Number(b.percentage) - Number(a.percentage))[0];
    const lastSubmittedAt = completed
      .map((a) => a.submittedAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: assessment.id,
      course_id: assessment.course.id,
      course_title: assessment.course.title,
      title: assessment.title,
      description: assessment.description,
      type: assessment.type,
      question_count: assessment._count.questions,
      total_marks: assessment.totalMarks,
      passing_marks: assessment.passingMarks,
      max_attempts: assessment.maxAttempts,
      due_date: assessment.dueDate ? assessment.dueDate.toISOString() : null,
      assigned_at: assessment.createdAt.toISOString(),
      my_attempts_used: assessment.attempts.length,
      my_status: assessment.attempts.some((a) => a.status === "IN_PROGRESS")
        ? "IN_PROGRESS"
        : completed.length > 0
          ? "COMPLETED"
          : "NOT_STARTED",
      my_best_result: computeBestAssessmentResult(assessment.attempts),
      my_best_score: best?.score != null ? Number(best.score) : null,
      my_best_percentage: best?.percentage != null ? Number(best.percentage) : null,
      my_last_submitted_at: lastSubmittedAt ? lastSubmittedAt.toISOString() : null,
    };
  });

  return {
    items,
    meta: { page: 1, pageSize: items.length || 1, totalItems: items.length, totalPages: 1 },
  };
}

/**
 * GET /api/v1/assessments/history — the caller's own completed (SUBMITTED/
 * GRADED) attempts, newest first, so past performance can be reviewed in one
 * place. Self-scoped (`userId`) AND limited to the same assessments
 * `listOwnAssessments` shows — PUBLISHED, in a PUBLISHED course the caller
 * still has effective access to — so no row can expose an assessment the
 * caller could not otherwise open, and every row's "View" link resolves.
 */
export async function listOwnAssessmentHistory(
  userId: string,
): Promise<{ items: MyAssessmentHistoryItem[]; meta: PaginationMeta }> {
  const rows = await prisma.assessmentAttempt.findMany({
    where: {
      userId,
      status: { in: ["SUBMITTED", "GRADED"] },
      assessment: {
        status: "PUBLISHED",
        course: { status: "PUBLISHED", ...effectiveCourseAccessFilter(userId) },
      },
    },
    select: {
      id: true,
      attemptNumber: true,
      submittedAt: true,
      startedAt: true,
      score: true,
      percentage: true,
      result: true,
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }, { id: "asc" }],
    take: 500,
  });

  const items: MyAssessmentHistoryItem[] = rows.map((row) => ({
    attempt_id: row.id,
    assessment_id: row.assessment.id,
    assessment_title: row.assessment.title,
    course_id: row.assessment.course.id,
    course_title: row.assessment.course.title,
    type: row.assessment.type,
    attempt_number: row.attemptNumber,
    submitted_at: row.submittedAt ? row.submittedAt.toISOString() : null,
    score: row.score !== null ? Number(row.score) : null,
    percentage: row.percentage !== null ? Number(row.percentage) : null,
    total_marks: row.assessment.totalMarks,
    passing_marks: row.assessment.passingMarks,
    result: row.result,
  }));

  return {
    items,
    meta: { page: 1, pageSize: items.length || 1, totalItems: items.length, totalPages: 1 },
  };
}

/** GET /api/v1/assessments/attempts/:id — the caller's own attempt only. */
export async function getOwnAttempt(
  userId: string,
  attemptId: string,
): Promise<AssessmentAttemptResponse> {
  const attempt = await findOwnedAttempt(userId, attemptId);
  return toAttemptResponse(attempt);
}

/** GET /api/v1/assessments/:id/attempts — the caller's own attempt history for this assessment. */
export async function listOwnAttempts(
  userId: string,
  assessmentId: string,
): Promise<{ items: AssessmentAttemptResponse[]; meta: PaginationMeta }> {
  await loadAuthorizedAssessment(userId, assessmentId);

  const rows = await prisma.assessmentAttempt.findMany({
    where: { assessmentId, userId },
    include: { answers: true },
    orderBy: { attemptNumber: "desc" },
  });

  return {
    items: rows.map(toAttemptResponse),
    meta: { page: 1, pageSize: rows.length || 1, totalItems: rows.length, totalPages: 1 },
  };
}

/**
 * POST /api/v1/assessments/attempts/:id/submit (SYSTEM_PLAN.md §19:
 * "Scoring happens server-side only, on submit"). Runs inside a transaction
 * (§18's "same DB transaction as that write" rule, extended to
 * assessment_attempts) together with: recording a completed
 * `training_sessions` row (Phase 3's hours-consumed ledger) and, if the
 * attempt is fully resolved (no answered SHORT_ANSWER/PRACTICAL_MANUAL
 * question left pending manual grading), recomputing `course_progress`.
 *
 * An unanswered SHORT_ANSWER/PRACTICAL_MANUAL question is scored 0 marks
 * immediately (nothing was submitted for a grader to review) rather than
 * left perpetually PENDING — only a genuinely *answered* manual question
 * blocks finalization.
 */
export async function submitAssessmentAttempt(
  userId: string,
  attemptId: string,
  input: SubmitAssessmentAttemptRequest,
): Promise<AssessmentAttemptResponse> {
  const attempt = await findOwnedAttempt(userId, attemptId);
  if (attempt.status !== "IN_PROGRESS") {
    throw new ConflictError("This attempt has already been submitted.");
  }

  const assessment = await prisma.assessment.findUniqueOrThrow({
    where: { id: attempt.assessmentId },
    include: { questions: { include: { options: true } } },
  });

  const answerByQuestionId = new Map(input.answers.map((a) => [a.question_id, a]));

  return prisma.$transaction(async (tx) => {
    let hasPendingManualGrading = false;
    let score = 0;

    for (const question of assessment.questions) {
      const submitted = answerByQuestionId.get(question.id);
      const selectedOptionId = submitted?.selected_option_id ?? null;
      const answerText = submitted?.answer_text ?? null;
      const wasAnswered = selectedOptionId !== null || (answerText !== null && answerText !== "");

      let isCorrect: boolean | null;
      let marksAwarded: number | null;

      if (AUTO_GRADABLE_TYPES.has(question.questionType)) {
        const selectedOption = selectedOptionId
          ? (question.options.find((o) => o.id === selectedOptionId) ?? null)
          : null;
        isCorrect = selectedOption?.isCorrect ?? false;
        marksAwarded = isCorrect ? question.marks : 0;
      } else if (wasAnswered) {
        // SHORT_ANSWER / PRACTICAL_MANUAL, genuinely answered — pending manual grading.
        isCorrect = null;
        marksAwarded = null;
        hasPendingManualGrading = true;
      } else {
        // SHORT_ANSWER / PRACTICAL_MANUAL, left blank — nothing to grade, scored 0.
        isCorrect = false;
        marksAwarded = 0;
      }

      if (marksAwarded !== null) score += marksAwarded;

      await tx.assessmentAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          selectedOptionId,
          answerText,
          isCorrect,
          marksAwarded,
        },
      });
    }

    const now = new Date();
    const updateData = hasPendingManualGrading
      ? { status: "SUBMITTED" as const, submittedAt: now }
      : {
          status: "GRADED" as const,
          submittedAt: now,
          score,
          percentage: Math.round((score / assessment.totalMarks) * 10000) / 100,
          result:
            (score / assessment.totalMarks) * 100 >= assessment.passingMarks
              ? ("PASS" as const)
              : ("FAIL" as const),
        };

    const updated = await tx.assessmentAttempt.update({
      where: { id: attempt.id },
      data: updateData,
      include: { answers: true },
    });

    await recordTrainingSessionForAssessmentAttempt(tx, {
      userId,
      courseId: assessment.courseId,
      startedAt: attempt.startedAt,
      submittedAt: now,
    });

    if (!hasPendingManualGrading) {
      await recomputeCourseProgress(tx, userId, assessment.courseId);
    }

    return toAttemptResponse(updated);
  }, LONG_TRANSACTION_OPTIONS);
}
