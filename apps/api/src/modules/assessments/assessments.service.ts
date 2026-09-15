import type {
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  ListAssessmentsQuery,
  AssessmentResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Assessment } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

function toResponse(assessment: Assessment): AssessmentResponse {
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
    status: assessment.status,
    created_by: assessment.createdBy,
    created_at: assessment.createdAt.toISOString(),
    updated_at: assessment.updatedAt.toISOString(),
  };
}

async function assertCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
}

/** Same cross-course-leak guard as course-modules.service.ts's findOwnedModule — a mismatched courseId is treated identically to "doesn't exist". */
async function findOwnedAssessment(courseId: string, id: string): Promise<Assessment> {
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.courseId !== courseId) {
    throw new NotFoundError(`No assessment exists with id "${id}" for course "${courseId}".`);
  }
  return assessment;
}

/** POST /api/v1/admin/courses/:courseId/assessments (SYSTEM_PLAN.md §14.4, permission `assessment.manage`). New assessments always start DRAFT. */
export async function createAssessment(
  courseId: string,
  input: CreateAssessmentRequest,
  createdBy: string,
): Promise<AssessmentResponse> {
  await assertCourseExists(courseId);

  const assessment = await prisma.assessment.create({
    data: {
      courseId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      totalMarks: input.total_marks,
      passingMarks: input.passing_marks,
      durationMinutes: input.duration_minutes ?? null,
      dueDate: input.due_date ? new Date(input.due_date) : null,
      ...(input.max_attempts !== undefined ? { maxAttempts: input.max_attempts } : {}),
      createdBy,
    },
  });
  return toResponse(assessment);
}

/** GET /api/v1/admin/courses/:courseId/assessments/:id. */
export async function getAssessment(courseId: string, id: string): Promise<AssessmentResponse> {
  await assertCourseExists(courseId);
  const assessment = await findOwnedAssessment(courseId, id);
  return toResponse(assessment);
}

/** GET /api/v1/admin/courses/:courseId/assessments — paginated, ordered by createdAt desc then id, matching courses.service.ts's listCourses ordering. */
export async function listAssessments(
  courseId: string,
  query: ListAssessmentsQuery,
): Promise<{ items: AssessmentResponse[]; meta: PaginationMeta }> {
  await assertCourseExists(courseId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { courseId };

  const [rows, totalItems] = await Promise.all([
    prisma.assessment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.assessment.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/** PATCH /api/v1/admin/courses/:courseId/assessments/:id — partial update, including status (DRAFT/PUBLISHED/ARCHIVED — no separate archive endpoint). */
export async function updateAssessment(
  courseId: string,
  id: string,
  input: UpdateAssessmentRequest,
): Promise<AssessmentResponse> {
  await assertCourseExists(courseId);
  const existing = await findOwnedAssessment(courseId, id);

  const effectiveTotalMarks = input.total_marks ?? existing.totalMarks;
  const effectivePassingMarks = input.passing_marks ?? existing.passingMarks;
  if (effectivePassingMarks > effectiveTotalMarks) {
    throw new ValidationError({
      passing_marks: ["passing_marks must not exceed total_marks."],
    });
  }

  const assessment = await prisma.assessment.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.total_marks !== undefined ? { totalMarks: input.total_marks } : {}),
      ...(input.passing_marks !== undefined ? { passingMarks: input.passing_marks } : {}),
      ...(input.duration_minutes !== undefined ? { durationMinutes: input.duration_minutes } : {}),
      ...(input.due_date !== undefined
        ? { dueDate: input.due_date ? new Date(input.due_date) : null }
        : {}),
      ...(input.max_attempts !== undefined ? { maxAttempts: input.max_attempts } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return toResponse(assessment);
}
