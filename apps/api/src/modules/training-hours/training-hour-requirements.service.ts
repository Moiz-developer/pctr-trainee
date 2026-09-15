import type {
  CreateTrainingHourRequirementRequest,
  ListTrainingHourRequirementsQuery,
  PaginationMeta,
  TrainingHourRequirement as TrainingHourRequirementResponse,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { ValidationError } from "../../lib/errors.js";

type RequirementRow = {
  id: string;
  scope: "DEPARTMENT" | "USER";
  departmentId: string | null;
  department: { name: string } | null;
  userId: string | null;
  user: { fullName: string } | null;
  requiredHours: unknown;
  effectiveFrom: Date;
  createdBy: string | null;
  createdAt: Date;
};

function toResponse(row: RequirementRow): TrainingHourRequirementResponse {
  return {
    id: row.id,
    scope: row.scope,
    department_id: row.departmentId,
    department_name: row.department?.name ?? null,
    user_id: row.userId,
    user_full_name: row.user?.fullName ?? null,
    required_hours: Number(row.requiredHours),
    effective_from: row.effectiveFrom.toISOString().slice(0, 10),
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * GET /api/v1/admin/training-hour-requirements (SYSTEM_PLAN.md §14.3,
 * permission `training.manage`). List-only — every applicable row is
 * relevant to resolving a trainee's allocated hours, so no filtering beyond
 * pagination is offered (matching this project's other admin-lookup list
 * endpoints, which likewise don't filter beyond what was explicitly asked
 * for).
 */
export async function listTrainingHourRequirements(
  query: ListTrainingHourRequirementsQuery,
): Promise<{ items: TrainingHourRequirementResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const [rows, totalItems] = await Promise.all([
    prisma.trainingHourRequirement.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        department: { select: { name: true } },
        user: { select: { fullName: true } },
      },
    }),
    prisma.trainingHourRequirement.count(),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * POST /api/v1/admin/training-hour-requirements. Appends a new row — this
 * table has no update/delete endpoint (see the shared schema's doc comment);
 * "changing" a requirement means adding a new row with a later
 * `effective_from`.
 */
export async function createTrainingHourRequirement(
  input: CreateTrainingHourRequirementRequest,
  createdBy: string,
): Promise<TrainingHourRequirementResponse> {
  if (input.scope === "DEPARTMENT") {
    const department = await prisma.department.findUnique({ where: { id: input.department_id } });
    if (!department) {
      throw new ValidationError({
        department_id: [`No department exists with id "${input.department_id}".`],
      });
    }
  } else {
    const user = await prisma.profile.findUnique({ where: { id: input.user_id } });
    if (!user) {
      throw new ValidationError({ user_id: [`No user exists with id "${input.user_id}".`] });
    }
  }

  const row = await prisma.trainingHourRequirement.create({
    data: {
      scope: input.scope,
      departmentId: input.scope === "DEPARTMENT" ? (input.department_id as string) : null,
      userId: input.scope === "USER" ? (input.user_id as string) : null,
      requiredHours: input.required_hours,
      effectiveFrom: new Date(input.effective_from),
      createdBy,
    },
    include: {
      department: { select: { name: true } },
      user: { select: { fullName: true } },
    },
  });

  return toResponse(row);
}
