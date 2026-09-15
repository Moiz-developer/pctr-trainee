import type { DepartmentResponse } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Announcement <-> Department targeting (SYSTEM_PLAN.md §14.6/§21, Phase
 * 5.3.2). Mirrors resource-departments.service.ts (and, before it,
 * course-departments.service.ts) function-for-function — the same
 * whole-set-replace shape, gated by `department.manage` (the department-
 * authority permission, not `announcement.manage`, matching that same
 * established precedent of gating "which departments can see this X" by
 * department authority regardless of which entity is on the other side).
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

async function assertAnnouncementExists(announcementId: string): Promise<void> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true },
  });
  if (!announcement) {
    throw new NotFoundError(`No announcement exists with id "${announcementId}".`);
  }
}

/** GET /api/v1/admin/announcements/:announcementId/departments — the announcement's current department assignments (empty = globally visible). */
export async function listAnnouncementDepartments(
  announcementId: string,
): Promise<DepartmentResponse[]> {
  await assertAnnouncementExists(announcementId);

  const rows = await prisma.announcementDepartment.findMany({
    where: { announcementId },
    include: { department: true },
    orderBy: { department: { name: "asc" } },
  });
  return rows.map((row) => toResponse(row.department));
}

/**
 * PUT /api/v1/admin/announcements/:announcementId/departments — replaces
 * the announcement's full department-assignment set. Every id must
 * reference an existing, active department. An empty array is valid and
 * meaningful: it makes the announcement globally visible (SYSTEM_PLAN.md
 * §14.6/§21). Diffs against the current set inside one transaction rather
 * than delete-all-then-recreate, so untouched rows aren't churned.
 */
export async function setAnnouncementDepartments(
  announcementId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  await assertAnnouncementExists(announcementId);

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

  const current = await prisma.announcementDepartment.findMany({
    where: { announcementId },
    select: { departmentId: true },
  });
  const currentIds = new Set(current.map((row) => row.departmentId));
  const nextIds = new Set(uniqueIds);
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.announcementDepartment.deleteMany({
            where: { announcementId, departmentId: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.announcementDepartment.createMany({
            data: toAdd.map((departmentId) => ({ announcementId, departmentId })),
          }),
        ]
      : []),
  ]);

  return listAnnouncementDepartments(announcementId);
}
