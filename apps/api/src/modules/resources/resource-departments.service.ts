import type { DepartmentResponse } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Resource <-> Department assignment (SYSTEM_PLAN.md §14.5/§20, Phase
 * 5.1). Mirrors course-departments.service.ts function-for-function — the
 * same whole-set-replace shape, gated by `department.manage` (the
 * department-authority permission, not `resource.manage`, matching
 * course_departments' own precedent of gating "which departments can see
 * this X" by department authority regardless of which entity is on the
 * other side).
 */

function toResponse(department: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DepartmentResponse {
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

async function assertResourceExists(resourceId: string): Promise<void> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true },
  });
  if (!resource) {
    throw new NotFoundError(`No resource exists with id "${resourceId}".`);
  }
}

/** GET /api/v1/admin/resources/:resourceId/departments — the resource's current department assignments (empty = globally visible). */
export async function listResourceDepartments(resourceId: string): Promise<DepartmentResponse[]> {
  await assertResourceExists(resourceId);

  const rows = await prisma.resourceDepartment.findMany({
    where: { resourceId },
    include: { department: true },
    orderBy: { department: { name: "asc" } },
  });
  return rows.map((row) => toResponse(row.department));
}

/**
 * PUT /api/v1/admin/resources/:resourceId/departments — replaces the
 * resource's full department-assignment set. Every id must reference an
 * existing, active department. An empty array is valid and meaningful: it
 * makes the resource globally visible (SYSTEM_PLAN.md §14.5/§20). Diffs
 * against the current set inside one transaction rather than
 * delete-all-then-recreate, so untouched rows aren't churned.
 */
export async function setResourceDepartments(
  resourceId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  await assertResourceExists(resourceId);

  const uniqueIds = [...new Set(departmentIds)];
  if (uniqueIds.length > 0) {
    const found = await prisma.department.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(found.map((d) => d.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError({
        department_ids: [
          `The following department ids do not exist or are not active: ${missing.join(", ")}.`,
        ],
      });
    }
  }

  const current = await prisma.resourceDepartment.findMany({
    where: { resourceId },
    select: { departmentId: true },
  });
  const currentIds = new Set(current.map((row) => row.departmentId));
  const nextIds = new Set(uniqueIds);
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.resourceDepartment.deleteMany({
            where: { resourceId, departmentId: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.resourceDepartment.createMany({
            data: toAdd.map((departmentId) => ({ resourceId, departmentId })),
          }),
        ]
      : []),
  ]);

  return listResourceDepartments(resourceId);
}
