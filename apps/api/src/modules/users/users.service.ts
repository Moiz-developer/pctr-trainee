import type {
  CreateUserRequest,
  UpdateUserRequest,
  AdminUserResponse,
  AssignUserDepartmentRequest,
  ListUsersQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { getSupabaseAdmin } from "../../lib/supabase-admin.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

type ProfileWithRoleAndDepartments = Prisma.ProfileGetPayload<{
  include: { role: true; memberships: { select: { departmentId: true } } };
}>;

function toResponse(profile: ProfileWithRoleAndDepartments): AdminUserResponse {
  return {
    id: profile.id,
    employee_id: profile.employeeId,
    full_name: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    status: profile.status,
    role: { id: profile.role.id, code: profile.role.code, name: profile.role.name },
    department_ids: profile.memberships.map((m) => m.departmentId),
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  };
}

/**
 * Validates that role_id references an existing role, and every entry in
 * department_ids references an existing, active department (SYSTEM_PLAN.md
 * §6: departments can be deactivated — a deactivated department shouldn't
 * accept new assignments). Throws ValidationError (422, §30) with
 * field-level messages on any invalid reference.
 */
async function validateRoleAndDepartments(roleId: string, departmentIds: string[]): Promise<void> {
  const fields: Record<string, string[]> = {};

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    fields.role_id = [`No role exists with id "${roleId}".`];
  }

  if (departmentIds.length > 0) {
    const uniqueIds = [...new Set(departmentIds)];
    const found = await prisma.department.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(found.map((d) => d.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      fields.department_ids = [
        `The following department ids do not exist or are not active: ${missing.join(", ")}.`,
      ];
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields);
  }
}

/**
 * POST /api/v1/admin/users (SYSTEM_PLAN.md §9): creates the Supabase Auth
 * user via the invite flow, then the profiles row + initial department
 * memberships. On profile-creation failure, deletes the just-created auth
 * user (§31's exact compensation rule) rather than leaving an orphaned Auth
 * identity with no profile.
 */
export async function createUser(
  input: CreateUserRequest,
  createdBy: string,
): Promise<AdminUserResponse> {
  const [existingByEmployeeId, existingByEmail] = await Promise.all([
    prisma.profile.findUnique({ where: { employeeId: input.employee_id } }),
    prisma.profile.findUnique({ where: { email: input.email } }),
  ]);
  if (existingByEmployeeId) {
    throw new ConflictError(`employee_id "${input.employee_id}" is already in use.`);
  }
  if (existingByEmail) {
    throw new ConflictError(`email "${input.email}" is already in use.`);
  }

  await validateRoleAndDepartments(input.role_id, input.department_ids);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    input.email,
  );
  if (inviteError || !inviteData.user) {
    if (inviteError?.code === "email_exists") {
      throw new ConflictError(`email "${input.email}" is already in use.`);
    }
    console.error("[users] Supabase invite failed:", inviteError?.message ?? "unknown error");
    throw new Error("Failed to invite the new user.");
  }
  const authUserId = inviteData.user.id;

  try {
    const profile = await prisma.profile.create({
      data: {
        id: authUserId,
        employeeId: input.employee_id,
        fullName: input.full_name,
        email: input.email,
        phone: input.phone ?? null,
        roleId: input.role_id,
        status: "ACTIVE",
        memberships: {
          create: input.department_ids.map((departmentId) => ({
            departmentId,
            assignedBy: createdBy,
          })),
        },
      },
      include: { role: true, memberships: { select: { departmentId: true } } },
    });
    return toResponse(profile);
  } catch (dbError) {
    console.error(
      "[users] profile creation failed after Auth user was created; compensating:",
      dbError,
    );
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      console.error(
        "[users] COMPENSATION FAILED — orphaned Supabase Auth user requires manual cleanup:",
        authUserId,
      );
    }
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A user with the given email or employee_id already exists.");
    }
    throw dbError;
  }
}

/**
 * PATCH /api/v1/admin/users/:id (SYSTEM_PLAN.md §26: "includes status
 * changes"). Only fields present in `input` are changed; omitted fields are
 * left untouched (standard partial-update semantics). If email changes,
 * profiles.email and auth.users.email are updated together, per §14.1's
 * "mirrors auth.users.email ... kept in sync on update".
 *
 * Does not touch department memberships — see this unit's implementation
 * report for why that's deliberately out of scope for this endpoint.
 */
export async function updateUser(id: string, input: UpdateUserRequest): Promise<AdminUserResponse> {
  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No user exists with id "${id}".`);
  }

  if (input.role_id !== undefined) {
    await validateRoleAndDepartments(input.role_id, []);
  }

  if (input.employee_id !== undefined && input.employee_id !== existing.employeeId) {
    const duplicate = await prisma.profile.findUnique({ where: { employeeId: input.employee_id } });
    if (duplicate) {
      throw new ConflictError(`employee_id "${input.employee_id}" is already in use.`);
    }
  }
  if (input.email !== undefined && input.email !== existing.email) {
    const duplicate = await prisma.profile.findUnique({ where: { email: input.email } });
    if (duplicate) {
      throw new ConflictError(`email "${input.email}" is already in use.`);
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (input.email !== undefined && input.email !== existing.email) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email: input.email,
    });
    if (authUpdateError) {
      if (authUpdateError.code === "email_exists") {
        throw new ConflictError(`email "${input.email}" is already in use.`);
      }
      console.error("[users] Supabase Auth email update failed:", authUpdateError.message);
      throw new Error("Failed to update the user's email.");
    }
  }

  try {
    const profile = await prisma.profile.update({
      where: { id },
      data: {
        ...(input.full_name !== undefined ? { fullName: input.full_name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.role_id !== undefined ? { roleId: input.role_id } : {}),
        ...(input.employee_id !== undefined ? { employeeId: input.employee_id } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { role: true, memberships: { select: { departmentId: true } } },
    });
    return toResponse(profile);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A user with the given email or employee_id already exists.");
    }
    throw dbError;
  }
}

/**
 * POST /api/v1/admin/users/:id/departments — assigns a department to a
 * user (SYSTEM_PLAN.md §40's "user-department assignment" deliverable; see
 * this unit's implementation report for the route/contract derivation).
 *
 * Reuses the same "department must exist and be active" rule already
 * established by `validateRoleAndDepartments` for user creation (SYSTEM_PLAN.md
 * §6: a deactivated department shouldn't accept new assignments).
 * `assignedBy` always comes from the authenticated identity, never the
 * request body, matching the existing anti-impersonation pattern used for
 * `createUser`'s `createdBy`. The database's composite primary key
 * (`user_id`, `department_id`, §14.1) is the actual concurrency backstop
 * for duplicate assignments — the P2002 catch, not a pre-check alone.
 */
export async function assignUserDepartment(
  userId: string,
  input: AssignUserDepartmentRequest,
  assignedBy: string,
): Promise<AdminUserResponse> {
  const existing = await prisma.profile.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new NotFoundError(`No user exists with id "${userId}".`);
  }

  const department = await prisma.department.findUnique({ where: { id: input.department_id } });
  if (!department || !department.isActive) {
    throw new ValidationError({
      department_id: [`No active department exists with id "${input.department_id}".`],
    });
  }

  try {
    await prisma.userDepartment.create({
      data: {
        userId,
        departmentId: input.department_id,
        isPrimary: input.is_primary ?? false,
        assignedBy,
      },
    });
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError(
        `User "${userId}" is already assigned to department "${input.department_id}".`,
      );
    }
    throw dbError;
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: userId },
    include: { role: true, memberships: { select: { departmentId: true } } },
  });
  return toResponse(profile);
}

/**
 * DELETE /api/v1/admin/users/:id/departments/:departmentId (new — Admin
 * Users + Departments UI unit). `user_departments` has no soft-state column
 * of its own (unlike `course_access`'s `revoked_at`, §14.1's own field list
 * for this table is just `user_id, department_id, is_primary, assigned_by,
 * assigned_at`) — a plain row delete is the schema-correct operation here,
 * not a deviation from the project's general soft-delete preference (§13),
 * since there is no history column to flip instead. Idempotent: removing an
 * assignment that doesn't exist is a no-op, not an error — matches the
 * project's general "re-revoking is a no-op" precedent (course-access
 * revoke). Permission `department.manage`, matching the assign endpoint
 * exactly (same resource, same gate).
 */
export async function removeUserDepartment(
  userId: string,
  departmentId: string,
): Promise<AdminUserResponse> {
  const existing = await prisma.profile.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new NotFoundError(`No user exists with id "${userId}".`);
  }

  await prisma.userDepartment.deleteMany({ where: { userId, departmentId } });

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: userId },
    include: { role: true, memberships: { select: { departmentId: true } } },
  });
  return toResponse(profile);
}

/**
 * GET /api/v1/admin/users (new — Admin Course & Training Content Management
 * unit: the Course Access UI needs to look up a user dynamically rather
 * than requiring a raw id, and no list endpoint existed). Paginated,
 * ordered by `full_name` for a stable, predictable picker order; optional
 * `search` matches `full_name`/`employee_id`/`email` (case-insensitive).
 */
export async function listUsers(
  query: ListUsersQuery,
): Promise<{ items: AdminUserResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: "insensitive" as const } },
            { employeeId: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.profile.findMany({
      where,
      include: { role: true, memberships: { select: { departmentId: true } } },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.profile.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
