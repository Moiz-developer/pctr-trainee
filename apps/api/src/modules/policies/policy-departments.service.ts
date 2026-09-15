import type { DepartmentResponse } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Policy <-> Department targeting (consistent granular access control unit,
 * §7). Mirrors resource-departments.service.ts/announcement-departments.
 * service.ts function-for-function — the same whole-set-replace shape,
 * gated by `department.manage` (the department-authority permission, not
 * `policy.manage`, matching that same established precedent).
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

async function assertPolicyExists(policyId: string): Promise<void> {
  const policy = await prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } });
  if (!policy) {
    throw new NotFoundError(`No policy exists with id "${policyId}".`);
  }
}

/** GET /api/v1/admin/policies/:policyId/departments — the policy's current department assignments (empty = globally visible). */
export async function listPolicyDepartments(policyId: string): Promise<DepartmentResponse[]> {
  await assertPolicyExists(policyId);

  const rows = await prisma.policyDepartment.findMany({
    where: { policyId },
    include: { department: true },
    orderBy: { department: { name: "asc" } },
  });
  return rows.map((row) => toResponse(row.department));
}

/**
 * PUT /api/v1/admin/policies/:policyId/departments — replaces the policy's
 * full department-assignment set. Every id must reference an existing,
 * active department. An empty array is valid and meaningful: it makes the
 * policy globally visible. Diffs against the current set inside one
 * transaction rather than delete-all-then-recreate.
 */
export async function setPolicyDepartments(
  policyId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  await assertPolicyExists(policyId);

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

  const current = await prisma.policyDepartment.findMany({
    where: { policyId },
    select: { departmentId: true },
  });
  const currentIds = new Set(current.map((row) => row.departmentId));
  const nextIds = new Set(uniqueIds);
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.policyDepartment.deleteMany({
            where: { policyId, departmentId: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.policyDepartment.createMany({
            data: toAdd.map((departmentId) => ({ policyId, departmentId })),
          }),
        ]
      : []),
  ]);

  return listPolicyDepartments(policyId);
}
