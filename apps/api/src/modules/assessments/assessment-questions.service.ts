import type {
  CreateAssessmentQuestionRequest,
  UpdateAssessmentQuestionRequest,
  ListAssessmentQuestionsQuery,
  AssessmentQuestionResponse,
  AssessmentQuestionOptionResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type {
  AssessmentQuestion,
  AssessmentQuestionOption,
} from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

type QuestionWithOptions = AssessmentQuestion & { options: AssessmentQuestionOption[] };

function toOptionResponse(option: AssessmentQuestionOption): AssessmentQuestionOptionResponse {
  return {
    id: option.id,
    question_id: option.questionId,
    option_text: option.optionText,
    is_correct: option.isCorrect,
    sort_order: option.sortOrder,
  };
}

function toResponse(question: QuestionWithOptions): AssessmentQuestionResponse {
  return {
    id: question.id,
    assessment_id: question.assessmentId,
    question_text: question.questionText,
    question_type: question.questionType,
    marks: question.marks,
    sort_order: question.sortOrder,
    created_at: question.createdAt.toISOString(),
    options: question.options
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toOptionResponse),
  };
}

/**
 * Verifies the full course -> assessment hierarchy, mirroring
 * course-lessons.service.ts's assertModuleInCourse exactly: an assessment
 * from a different course is treated identically to "doesn't exist" — 404
 * — so the mismatch never leaks which course an assessment really belongs to.
 */
export async function assertAssessmentInCourse(
  courseId: string,
  assessmentId: string,
): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, courseId: true },
  });
  if (!assessment || assessment.courseId !== courseId) {
    throw new NotFoundError(
      `No assessment exists with id "${assessmentId}" for course "${courseId}".`,
    );
  }
}

/** Same treatment for the question leaf: a question from a different assessment is "doesn't exist". */
export async function findOwnedQuestion(
  assessmentId: string,
  id: string,
): Promise<QuestionWithOptions> {
  const question = await prisma.assessmentQuestion.findUnique({
    where: { id },
    include: { options: true },
  });
  if (!question || question.assessmentId !== assessmentId) {
    throw new NotFoundError(`No question exists with id "${id}" for assessment "${assessmentId}".`);
  }
  return question;
}

/** POST .../assessments/:assessmentId/questions (SYSTEM_PLAN.md §14.4, permission `assessment.manage`). Options are added afterward via their own nested endpoint. */
export async function createAssessmentQuestion(
  courseId: string,
  assessmentId: string,
  input: CreateAssessmentQuestionRequest,
): Promise<AssessmentQuestionResponse> {
  await assertAssessmentInCourse(courseId, assessmentId);

  const question = await prisma.assessmentQuestion.create({
    data: {
      assessmentId,
      questionText: input.question_text,
      questionType: input.question_type,
      marks: input.marks,
      sortOrder: input.sort_order,
    },
    include: { options: true },
  });
  return toResponse(question);
}

/** GET .../assessments/:assessmentId/questions/:id — verifies the full course -> assessment -> question chain. */
export async function getAssessmentQuestion(
  courseId: string,
  assessmentId: string,
  id: string,
): Promise<AssessmentQuestionResponse> {
  await assertAssessmentInCourse(courseId, assessmentId);
  const question = await findOwnedQuestion(assessmentId, id);
  return toResponse(question);
}

/** GET .../assessments/:assessmentId/questions — paginated, ordered by sort_order then id. */
export async function listAssessmentQuestions(
  courseId: string,
  assessmentId: string,
  query: ListAssessmentQuestionsQuery,
): Promise<{ items: AssessmentQuestionResponse[]; meta: PaginationMeta }> {
  await assertAssessmentInCourse(courseId, assessmentId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { assessmentId };

  const [rows, totalItems] = await Promise.all([
    prisma.assessmentQuestion.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { options: true },
    }),
    prisma.assessmentQuestion.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/** PATCH .../assessments/:assessmentId/questions/:id — partial update. `sort_order` changes only this question's own value; siblings are never renumbered. */
export async function updateAssessmentQuestion(
  courseId: string,
  assessmentId: string,
  id: string,
  input: UpdateAssessmentQuestionRequest,
): Promise<AssessmentQuestionResponse> {
  await assertAssessmentInCourse(courseId, assessmentId);
  await findOwnedQuestion(assessmentId, id);

  const question = await prisma.assessmentQuestion.update({
    where: { id },
    data: {
      ...(input.question_text !== undefined ? { questionText: input.question_text } : {}),
      ...(input.question_type !== undefined ? { questionType: input.question_type } : {}),
      ...(input.marks !== undefined ? { marks: input.marks } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    },
    include: { options: true },
  });
  return toResponse(question);
}
