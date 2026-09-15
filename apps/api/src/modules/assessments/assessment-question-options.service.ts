import type {
  CreateAssessmentQuestionOptionRequest,
  UpdateAssessmentQuestionOptionRequest,
  ListAssessmentQuestionOptionsQuery,
  AssessmentQuestionOptionResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { AssessmentQuestionOption } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { assertAssessmentInCourse, findOwnedQuestion } from "./assessment-questions.service.js";

// §14.4: "(Not used for SHORT_ANSWER/PRACTICAL_MANUAL question types.)"
const OPTIONLESS_QUESTION_TYPES = new Set(["SHORT_ANSWER", "PRACTICAL_MANUAL"]);

function toResponse(option: AssessmentQuestionOption): AssessmentQuestionOptionResponse {
  return {
    id: option.id,
    question_id: option.questionId,
    option_text: option.optionText,
    is_correct: option.isCorrect,
    sort_order: option.sortOrder,
  };
}

/** Same leaf-ownership check as findOwnedQuestion, one level deeper. */
async function findOwnedOption(questionId: string, id: string): Promise<AssessmentQuestionOption> {
  const option = await prisma.assessmentQuestionOption.findUnique({ where: { id } });
  if (!option || option.questionId !== questionId) {
    throw new NotFoundError(`No option exists with id "${id}" for question "${questionId}".`);
  }
  return option;
}

/** POST .../questions/:questionId/options (SYSTEM_PLAN.md §14.4, permission `assessment.manage`). Rejects SHORT_ANSWER/PRACTICAL_MANUAL parents — those question types are never option-backed. */
export async function createAssessmentQuestionOption(
  courseId: string,
  assessmentId: string,
  questionId: string,
  input: CreateAssessmentQuestionOptionRequest,
): Promise<AssessmentQuestionOptionResponse> {
  await assertAssessmentInCourse(courseId, assessmentId);
  const question = await findOwnedQuestion(assessmentId, questionId);

  if (OPTIONLESS_QUESTION_TYPES.has(question.questionType)) {
    throw new ValidationError({
      question_id: [
        `Options are not used for ${question.questionType} questions (SYSTEM_PLAN.md §14.4).`,
      ],
    });
  }

  const option = await prisma.assessmentQuestionOption.create({
    data: {
      questionId,
      optionText: input.option_text,
      isCorrect: input.is_correct ?? false,
      sortOrder: input.sort_order,
    },
  });
  return toResponse(option);
}

/** GET .../questions/:questionId/options — full course -> assessment -> question -> option chain verified. */
export async function listAssessmentQuestionOptions(
  courseId: string,
  assessmentId: string,
  questionId: string,
  query: ListAssessmentQuestionOptionsQuery,
): Promise<{ items: AssessmentQuestionOptionResponse[]; meta: PaginationMeta }> {
  await assertAssessmentInCourse(courseId, assessmentId);
  await findOwnedQuestion(assessmentId, questionId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const where = { questionId };

  const [rows, totalItems] = await Promise.all([
    prisma.assessmentQuestionOption.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessmentQuestionOption.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/** PATCH .../options/:id — partial update. */
export async function updateAssessmentQuestionOption(
  courseId: string,
  assessmentId: string,
  questionId: string,
  id: string,
  input: UpdateAssessmentQuestionOptionRequest,
): Promise<AssessmentQuestionOptionResponse> {
  await assertAssessmentInCourse(courseId, assessmentId);
  await findOwnedQuestion(assessmentId, questionId);
  await findOwnedOption(questionId, id);

  const option = await prisma.assessmentQuestionOption.update({
    where: { id },
    data: {
      ...(input.option_text !== undefined ? { optionText: input.option_text } : {}),
      ...(input.is_correct !== undefined ? { isCorrect: input.is_correct } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
    },
  });
  return toResponse(option);
}
