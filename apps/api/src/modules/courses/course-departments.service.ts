import type { DepartmentResponse } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

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

async function assertCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
}

/** GET /api/v1/admin/courses/:courseId/departments — the course's current department assignments. */
export async function listCourseDepartments(courseId: string): Promise<DepartmentResponse[]> {
  await assertCourseExists(courseId);

  const rows = await prisma.courseDepartment.findMany({
    where: { courseId },
    include: { department: true },
    orderBy: { department: { name: "asc" } },
  });
  return rows.map((row) => toResponse(row.department));
}

/**
 * PUT /api/v1/admin/courses/:courseId/departments — replaces the course's
 * full department-assignment set. Every id must reference an existing,
 * active department (same "deactivated department shouldn't accept new
 * assignments" rule as user<->department assignment, SYSTEM_PLAN.md §6).
 * Diffs against the current set inside one transaction rather than
 * delete-all-then-recreate, so untouched rows aren't churned.
 */
export async function setCourseDepartments(
  courseId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  await assertCourseExists(courseId);

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

  const current = await prisma.courseDepartment.findMany({
    where: { courseId },
    select: { departmentId: true },
  });
  const currentIds = new Set(current.map((row) => row.departmentId));
  const nextIds = new Set(uniqueIds);
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.courseDepartment.deleteMany({
            where: { courseId, departmentId: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.courseDepartment.createMany({
            data: toAdd.map((departmentId) => ({ courseId, departmentId })),
          }),
        ]
      : []),
  ]);

  return listCourseDepartments(courseId);
}
