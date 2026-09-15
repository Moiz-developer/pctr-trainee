import type {
  CreateResourceCategoryRequest,
  UpdateResourceCategoryRequest,
  ListResourceCategoriesQuery,
  ResourceCategoryResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type ResourceCategory } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Resource Categories (SYSTEM_PLAN.md §14.5/§20, Phase 5.1). Mirrors
 * course-categories.service.ts function-for-function — same admin-managed-
 * lookup-table CRUD shape, same name/slug-conflict-precheck-then-P2002-
 * backstop pattern. Permission `resource.manage` (see
 * resource-categories.routes.ts) in place of `course.create`.
 */

function toResponse(category: ResourceCategory): ResourceCategoryResponse {
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
    prisma.resourceCategory.findUnique({ where: { name } }),
    prisma.resourceCategory.findUnique({ where: { slug } }),
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
 * check, mirrors course-categories.service.ts's identical helper.
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

/** POST /api/v1/admin/resource-categories (permission `resource.manage`). */
export async function createResourceCategory(
  input: CreateResourceCategoryRequest,
): Promise<ResourceCategoryResponse> {
  await assertNoConflict(input.name, input.slug);
  if (input.department_id) {
    await assertDepartmentExists(input.department_id);
  }

  try {
    const category = await prisma.resourceCategory.create({
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

/** GET /api/v1/admin/resource-categories/:id. */
export async function getResourceCategory(id: string): Promise<ResourceCategoryResponse> {
  const category = await prisma.resourceCategory.findUnique({ where: { id } });
  if (!category) {
    throw new NotFoundError(`No category exists with id "${id}".`);
  }
  return toResponse(category);
}

/**
 * GET /api/v1/admin/resource-categories — paginated, optionally filtered by
 * `is_active`. Inactive categories remain listed unless explicitly filtered
 * out, matching course-categories' own convention.
 */
export async function listResourceCategories(
  query: ListResourceCategoriesQuery,
): Promise<{ items: ResourceCategoryResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = query.is_active !== undefined ? { isActive: query.is_active } : {};

  const [rows, totalItems] = await Promise.all([
    prisma.resourceCategory.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.resourceCategory.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * PATCH /api/v1/admin/resource-categories/:id — partial update, including
 * `is_active` toggling.
 */
export async function updateResourceCategory(
  id: string,
  input: UpdateResourceCategoryRequest,
): Promise<ResourceCategoryResponse> {
  const existing = await prisma.resourceCategory.findUnique({ where: { id } });
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
    const category = await prisma.resourceCategory.update({
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
