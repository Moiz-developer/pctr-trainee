import type {
  CreateCourseCategoryRequest,
  UpdateCourseCategoryRequest,
  ListCourseCategoriesQuery,
  CourseCategoryResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type CourseCategory } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Course Categories (Admin Navigation + Dynamic Course Categories unit).
 * Mirrors modules/departments/departments.service.ts function-for-function
 * — same admin-managed-lookup-table CRUD shape, same
 * name/slug-conflict-precheck-then-P2002-backstop pattern.
 */

function toResponse(category: CourseCategory): CourseCategoryResponse {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    is_active: category.isActive,
    department_id: category.departmentId,
    created_at: category.createdAt.toISOString(),
    updated_at: category.updatedAt.toISOString(),
  };
}

async function assertNoConflict(name: string, slug: string, excludeId?: string): Promise<void> {
  const [byName, bySlug] = await Promise.all([
    prisma.courseCategory.findUnique({ where: { name } }),
    prisma.courseCategory.findUnique({ where: { slug } }),
  ]);
  if (byName && byName.id !== excludeId) {
    throw new ConflictError(`name "${name}" is already in use.`);
  }
  if (bySlug && bySlug.id !== excludeId) {
    throw new ConflictError(`slug "${slug}" is already in use.`);
  }
}

/**
 * Department -> Category -> Training Content hierarchy unit: existence-only
 * check (mirrors how Course.categoryId/Resource.categoryId themselves are
 * validated elsewhere) — not gated on `is_active`, so a category already
 * assigned to a department that's since been deactivated is never
 * retroactively broken by this check; it only guards against a
 * client-supplied id that doesn't exist at all.
 */
async function assertDepartmentExists(departmentId: string): Promise<void> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!department) {
    throw new ValidationError({
      department_id: [`No department exists with id "${departmentId}".`],
    });
  }
}

/** POST /api/v1/admin/course-categories (permission `course.create`). */
export async function createCourseCategory(
  input: CreateCourseCategoryRequest,
): Promise<CourseCategoryResponse> {
  await assertNoConflict(input.name, input.slug);
  if (input.department_id) {
    await assertDepartmentExists(input.department_id);
  }

  try {
    const category = await prisma.courseCategory.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        departmentId: input.department_id ?? null,
      },
    });
    return toResponse(category);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A category with the given name or slug already exists.");
    }
    throw dbError;
  }
}

/** GET /api/v1/admin/course-categories/:id. */
export async function getCourseCategory(id: string): Promise<CourseCategoryResponse> {
  const category = await prisma.courseCategory.findUnique({ where: { id } });
  if (!category) {
    throw new NotFoundError(`No category exists with id "${id}".`);
  }
  return toResponse(category);
}

/**
 * GET /api/v1/admin/course-categories — paginated, optionally filtered by
 * `is_active`. Inactive categories remain listed unless explicitly
 * filtered out, matching the department list endpoint's convention.
 */
export async function listCourseCategories(
  query: ListCourseCategoriesQuery,
): Promise<{ items: CourseCategoryResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = query.is_active !== undefined ? { isActive: query.is_active } : {};

  const [rows, totalItems] = await Promise.all([
    prisma.courseCategory.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseCategory.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * PATCH /api/v1/admin/course-categories/:id — partial update, including
 * `is_active` toggling (this unit's activate/deactivate requirement).
 */
export async function updateCourseCategory(
  id: string,
  input: UpdateCourseCategoryRequest,
): Promise<CourseCategoryResponse> {
  const existing = await prisma.courseCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No category exists with id "${id}".`);
  }

  if (input.name !== undefined || input.slug !== undefined) {
    await assertNoConflict(input.name ?? existing.name, input.slug ?? existing.slug, id);
  }
  if (input.department_id) {
    await assertDepartmentExists(input.department_id);
  }

  try {
    const category = await prisma.courseCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
        ...(input.department_id !== undefined ? { departmentId: input.department_id } : {}),
      },
    });
    return toResponse(category);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A category with the given name or slug already exists.");
    }
    throw dbError;
  }
}
