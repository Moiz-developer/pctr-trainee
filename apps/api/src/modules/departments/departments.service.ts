import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  ListDepartmentsQuery,
  DepartmentResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type Department } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

function toResponse(department: Department): DepartmentResponse {
  return {
    id: department.id,
    name: department.name,
    slug: department.slug,
    description: department.description,
    is_active: department.isActive,
    created_at: department.createdAt.toISOString(),
    updated_at: department.updatedAt.toISOString(),
  };
}

/**
 * Pre-checks name/slug uniqueness so conflicts get a specific field-level
 * message (SYSTEM_PLAN.md §14.1's unique constraints on both columns); the
 * P2002 catch in create/update remains the actual concurrency backstop.
 */
async function assertNoConflict(name: string, slug: string, excludeId?: string): Promise<void> {
  const [byName, bySlug] = await Promise.all([
    prisma.department.findUnique({ where: { name } }),
    prisma.department.findUnique({ where: { slug } }),
  ]);
  if (byName && byName.id !== excludeId) {
    throw new ConflictError(`name "${name}" is already in use.`);
  }
  if (bySlug && bySlug.id !== excludeId) {
    throw new ConflictError(`slug "${slug}" is already in use.`);
  }
}

/** POST /api/v1/admin/departments (SYSTEM_PLAN.md §26, permission `department.manage`). */
export async function createDepartment(
  input: CreateDepartmentRequest,
): Promise<DepartmentResponse> {
  await assertNoConflict(input.name, input.slug);

  try {
    const department = await prisma.department.create({
      data: { name: input.name, slug: input.slug, description: input.description ?? null },
    });
    return toResponse(department);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A department with the given name or slug already exists.");
    }
    throw dbError;
  }
}

/** GET /api/v1/admin/departments/:id. */
export async function getDepartment(id: string): Promise<DepartmentResponse> {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) {
    throw new NotFoundError(`No department exists with id "${id}".`);
  }
  return toResponse(department);
}

/**
 * GET /api/v1/admin/departments — paginated, optionally filtered by
 * `is_active` (SYSTEM_PLAN.md §26/§33). Inactive departments remain listed
 * unless explicitly filtered out; the plan gives no reason to hide them by
 * default from an admin-only endpoint.
 */
export async function listDepartments(
  query: ListDepartmentsQuery,
): Promise<{ items: DepartmentResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = query.is_active !== undefined ? { isActive: query.is_active } : {};

  const [rows, totalItems] = await Promise.all([
    prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.department.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/** PATCH /api/v1/admin/departments/:id — partial update, including `is_active` toggling. */
export async function updateDepartment(
  id: string,
  input: UpdateDepartmentRequest,
): Promise<DepartmentResponse> {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No department exists with id "${id}".`);
  }

  if (input.name !== undefined || input.slug !== undefined) {
    await assertNoConflict(input.name ?? existing.name, input.slug ?? existing.slug, id);
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
      },
    });
    return toResponse(department);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A department with the given name or slug already exists.");
    }
    throw dbError;
  }
}
