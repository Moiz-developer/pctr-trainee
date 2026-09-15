import type {
  CreateCourseRequest,
  UpdateCourseRequest,
  ListCoursesQuery,
  CourseResponse,
  CourseSummary,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type Course, type CourseCategory } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

type CourseWithCategory = Course & { category: CourseCategory | null };

const withCategory = { include: { category: true } } as const;

function toResponse(course: CourseWithCategory): CourseResponse {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail_media_id: course.thumbnailMediaId,
    category: course.category ? { id: course.category.id, name: course.category.name } : null,
    duration_minutes: course.durationMinutes,
    status: course.status,
    completion_require_all_lessons: course.completionRequireAllLessons,
    completion_require_practical: course.completionRequirePractical,
    completion_require_assessment_pass: course.completionRequireAssessmentPass,
    completion_min_assessment_score_pct: course.completionMinAssessmentScorePct,
    created_by: course.createdBy,
    created_at: course.createdAt.toISOString(),
    updated_at: course.updatedAt.toISOString(),
    archived_at: course.archivedAt ? course.archivedAt.toISOString() : null,
  };
}

function toSummary(course: CourseWithCategory): CourseSummary {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    category: course.category ? { id: course.category.id, name: course.category.name } : null,
    duration_minutes: course.durationMinutes,
    status: course.status,
    created_at: course.createdAt.toISOString(),
    updated_at: course.updatedAt.toISOString(),
  };
}

/**
 * Validates that `category_id`, if supplied, references an existing,
 * active `course_categories` row — same "never trust the client" rule and
 * shape as `validateRoleAndDepartments` (users.service.ts). A deactivated
 * category shouldn't accept new course assignments, mirroring the
 * department active-status rule.
 */
async function validateCategory(categoryId: string): Promise<void> {
  const category = await prisma.courseCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw new ValidationError({
      category_id: [`No active category exists with id "${categoryId}".`],
    });
  }
}

/** POST /api/v1/admin/courses (SYSTEM_PLAN.md §14.2, permission `course.create`). */
export async function createCourse(
  input: CreateCourseRequest,
  createdBy: string,
): Promise<CourseResponse> {
  const existing = await prisma.course.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new ConflictError(`slug "${input.slug}" is already in use.`);
  }
  if (input.category_id) {
    await validateCategory(input.category_id);
  }

  try {
    const course = await prisma.course.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description ?? null,
        categoryId: input.category_id ?? null,
        durationMinutes: input.duration_minutes ?? null,
        ...(input.completion_require_all_lessons !== undefined
          ? { completionRequireAllLessons: input.completion_require_all_lessons }
          : {}),
        ...(input.completion_require_practical !== undefined
          ? { completionRequirePractical: input.completion_require_practical }
          : {}),
        ...(input.completion_require_assessment_pass !== undefined
          ? { completionRequireAssessmentPass: input.completion_require_assessment_pass }
          : {}),
        completionMinAssessmentScorePct: input.completion_min_assessment_score_pct ?? null,
        createdBy,
      },
      ...withCategory,
    });
    return toResponse(course);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError(`slug "${input.slug}" is already in use.`);
    }
    throw dbError;
  }
}

/** GET /api/v1/admin/courses/:id. */
export async function getCourse(id: string): Promise<CourseResponse> {
  const course = await prisma.course.findUnique({ where: { id }, ...withCategory });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${id}".`);
  }
  return toResponse(course);
}

/**
 * GET /api/v1/admin/courses — paginated, optionally filtered by `status`
 * (SYSTEM_PLAN.md §26 names "status" as basic admin-list filtering).
 * Returns summary DTOs (§33) — no department/access filtering, since
 * course_access/access.service.ts are out of scope for this unit.
 */
export async function listCourses(
  query: ListCoursesQuery,
): Promise<{ items: CourseSummary[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = query.status !== undefined ? { status: query.status } : {};

  const [rows, totalItems] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withCategory,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: rows.map(toSummary),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/admin/courses/progress-summary (Admin Dashboard real data
 * unit): a single real count — every `course_progress` row, across every
 * trainee, currently `status = IN_PROGRESS` — the exact same `course_progress`
 * derived-cache table/model course-progress.service.ts already maintains,
 * just aggregated with a plain `count()` rather than duplicating any of that
 * recompute logic.
 */
export async function getCourseProgressSummary(): Promise<{ inProgressCount: number }> {
  const inProgressCount = await prisma.courseProgress.count({ where: { status: "IN_PROGRESS" } });
  return { inProgressCount };
}

/**
 * PATCH /api/v1/admin/courses/:id — partial update. `status` here is
 * restricted to `DRAFT`/`PUBLISHED` at the Zod layer (see
 * packages/shared/src/api/courses.ts) — `ARCHIVED` only via `archiveCourse`.
 */
export async function updateCourse(
  id: string,
  input: UpdateCourseRequest,
): Promise<CourseResponse> {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No course exists with id "${id}".`);
  }

  if (input.slug !== undefined && input.slug !== existing.slug) {
    const duplicate = await prisma.course.findUnique({ where: { slug: input.slug } });
    if (duplicate) {
      throw new ConflictError(`slug "${input.slug}" is already in use.`);
    }
  }
  if (input.category_id !== undefined && input.category_id !== null) {
    await validateCategory(input.category_id);
  }

  try {
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category_id !== undefined ? { categoryId: input.category_id } : {}),
        ...(input.duration_minutes !== undefined
          ? { durationMinutes: input.duration_minutes }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.completion_require_all_lessons !== undefined
          ? { completionRequireAllLessons: input.completion_require_all_lessons }
          : {}),
        ...(input.completion_require_practical !== undefined
          ? { completionRequirePractical: input.completion_require_practical }
          : {}),
        ...(input.completion_require_assessment_pass !== undefined
          ? { completionRequireAssessmentPass: input.completion_require_assessment_pass }
          : {}),
        ...(input.completion_min_assessment_score_pct !== undefined
          ? { completionMinAssessmentScorePct: input.completion_min_assessment_score_pct }
          : {}),
      },
      ...withCategory,
    });
    return toResponse(course);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError(`slug "${input.slug}" is already in use.`);
    }
    throw dbError;
  }
}

/**
 * POST /api/v1/admin/courses/:id/archive — moves a course to `ARCHIVED` and
 * stamps `archived_at` (SYSTEM_PLAN.md: "Archiving must preserve the
 * database record... Use archivedAt consistently"). No hard delete. Callable
 * regardless of current status — idempotent, no invented "already archived"
 * error, since the plan doesn't define one.
 */
export async function archiveCourse(id: string): Promise<CourseResponse> {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No course exists with id "${id}".`);
  }

  const course = await prisma.course.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    ...withCategory,
  });
  return toResponse(course);
}
