import type {
  AdminAssessmentAttempt,
  GradeAssessmentAttemptRequest,
  ListAdminAssessmentAttemptsQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma, LONG_TRANSACTION_OPTIONS } from "../../lib/prisma.js";
import type {
  AssessmentAnswer,
  AssessmentAttempt,
  Profile,
} from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recomputeCourseProgress } from "../progress/course-progress.service.js";
import { assertAssessmentInCourse } from "./assessment-questions.service.js";

type AttemptWithUserAndAnswers = AssessmentAttempt & {
  user: Pick<Profile, "id" | "fullName">;
  answers: AssessmentAnswer[];
};

function toAdminResponse(attempt: AttemptWithUserAndAnswers): AdminAssessmentAttempt {
  return {
    id: attempt.id,
    assessment_id: attempt.assessmentId,
    user_id: attempt.userId,
    user_full_name: attempt.user.fullName,
    attempt_number: attempt.attemptNumber,
    started_at: attempt.startedAt.toISOString(),
    submitted_at: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    score: attempt.score !== null ? Number(attempt.score) : null,
    percentage: attempt.percentage !== null ? Number(attempt.percentage) : null,
    result: attempt.result,
    status: attempt.status,
    answers: attempt.answers.map((answer) => ({
      question_id: answer.questionId,
      selected_option_id: answer.selectedOptionId,
      answer_text: answer.answerText,
      is_correct: answer.isCorrect,
      marks_awarded: answer.marksAwarded !== null ? Number(answer.marksAwarded) : null,
    })),
  };
}

/**
 * GET .../assessments/:assessmentId/attempts (SYSTEM_PLAN.md §Open
 * Questions #5, permission `assessment.grade`/`assessment.manage`) — the
 * admin oversight/grading queue for one assessment. `?status=SUBMITTED`
 * filters to attempts awaiting manual grading.
 */
export async function listAttemptsForGrading(
  courseId: string,
  assessmentId: string,
  query: ListAdminAssessmentAttemptsQuery,
): Promise<{ items: AdminAssessmentAttempt[]; meta: PaginationMeta }> {
  await assertAssessmentInCourse(courseId, assessmentId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { assessmentId, ...(query.status !== undefined ? { status: query.status } : {}) };

  const [rows, totalItems] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, fullName: true } }, answers: true },
    }),
    prisma.assessmentAttempt.count({ where }),
  ]);

  return {
    items: rows.map(toAdminResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * POST .../attempts/:attemptId/grade (SYSTEM_PLAN.md §14.4: "a small
 * graded_by/graded_at pair ... for this path"). Grades every still-pending
 * (is_correct IS NULL) answer on the attempt in one call — every such answer
 * must be covered by the request, since `result`/`score` can only be
 * finalized once the whole attempt has a mark. Runs inside a transaction
 * that also recomputes the TRAINEE's `course_progress` (§18/§19) — this is
 * the one write path in this codebase where the acting identity (the
 * grading admin) differs from the row owner (the trainee); see this
 * migration's RLS bridge comment (20260911140000_assessments/migration.sql)
 * for why that's safe here specifically.
 */
export async function gradeAssessmentAttempt(
  courseId: string,
  assessmentId: string,
  attemptId: string,
  gradedBy: string,
  input: GradeAssessmentAttemptRequest,
): Promise<AdminAssessmentAttempt> {
  await assertAssessmentInCourse(courseId, assessmentId);

  const assessment = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt || attempt.assessmentId !== assessmentId) {
    throw new NotFoundError(
      `No attempt exists with id "${attemptId}" for assessment "${assessmentId}".`,
    );
  }
  if (attempt.status !== "SUBMITTED") {
    throw new ConflictError('This attempt is not awaiting grading (status must be "SUBMITTED").');
  }

  const pendingAnswers = attempt.answers.filter((a) => a.isCorrect === null);
  const gradeByQuestionId = new Map(input.grades.map((g) => [g.question_id, g]));
  const missing = pendingAnswers.filter((a) => !gradeByQuestionId.has(a.questionId));
  if (missing.length > 0) {
    throw new ValidationError({
      grades: [
        `Missing a grade for ${missing.length} pending question(s): ${missing.map((a) => a.questionId).join(", ")}.`,
      ],
    });
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    for (const pending of pendingAnswers) {
      const grade = gradeByQuestionId.get(pending.questionId)!;
      await tx.assessmentAnswer.update({
        where: { id: pending.id },
        data: {
          isCorrect: grade.is_correct ?? grade.marks_awarded > 0,
          marksAwarded: grade.marks_awarded,
          gradedBy,
          gradedAt: now,
        },
      });
    }

    const allAnswers = await tx.assessmentAnswer.findMany({ where: { attemptId } });
    const score = allAnswers.reduce(
      (sum, a) => sum + (a.marksAwarded ? Number(a.marksAwarded) : 0),
      0,
    );
    const percentage = Math.round((score / assessment.totalMarks) * 10000) / 100;
    const result =
      (score / assessment.totalMarks) * 100 >= assessment.passingMarks ? "PASS" : "FAIL";

    const updated = await tx.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: "GRADED", score, percentage, result },
      include: { user: { select: { id: true, fullName: true } }, answers: true },
    });

    await recomputeCourseProgress(tx, attempt.userId, assessment.courseId);

    return toAdminResponse(updated);
  }, LONG_TRANSACTION_OPTIONS);
}
