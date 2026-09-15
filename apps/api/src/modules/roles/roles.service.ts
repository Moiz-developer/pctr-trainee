import type {
  CreateRoleRequest,
  UpdateRoleRequest,
  ListRolesQuery,
  RoleResponse,
  PermissionResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type Role, type Permission } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

/**
 * Admin Role & Permission Management (SYSTEM_PLAN.md §5/§10). Reuses the
 * existing `roles`/`permissions`/`role_permissions` tables and the existing
 * `has_permission(code)` authorization model verbatim — this file only adds
 * CRUD over data those tables/that model already define. Mirrors
 * resource-categories.service.ts's create/update shape (name/code-conflict
 * precheck + P2002 backstop) and course-departments.service.ts's
 * setCourseDepartments shape (whole-set-replace via a transactional diff)
 * — no new patterns invented.
 *
 * Permission CODES themselves are NOT creatable/editable here — they stay
 * defined in apps/api/src/db/seed.ts's `PERMISSIONS` array, because each
 * one corresponds to an actual `requirePermission(code)` check hard-coded
 * somewhere in this codebase; a permission code with no matching check
 * anywhere would be meaningless to grant. Only which ROLE holds which
 * already-real permission is dynamic.
 */

type RoleWithPermissions = Role & { rolePermissions: { permissionId: string }[] };

function toRoleResponse(role: RoleWithPermissions): RoleResponse {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    is_system: role.isSystem,
    permission_ids: role.rolePermissions.map((rp) => rp.permissionId),
    created_at: role.createdAt.toISOString(),
    updated_at: role.updatedAt.toISOString(),
  };
}

function toPermissionResponse(permission: Permission): PermissionResponse {
  return {
    id: permission.id,
    code: permission.code,
    description: permission.description,
    created_at: permission.createdAt.toISOString(),
  };
}

const withPermissions = {
  include: { rolePermissions: { select: { permissionId: true } } },
} as const;

async function assertNoCodeConflict(code: string, excludeId?: string): Promise<void> {
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing && existing.id !== excludeId) {
    throw new ConflictError(`code "${code}" is already in use.`);
  }
}

/**
 * POST /api/v1/admin/roles (permission `role.manage`). `is_system` is never
 * accepted from the request — always `false` for a role created here (see
 * createRoleRequestSchema's own doc comment). A brand-new role starts with
 * no permissions; grant them via `setRolePermissions` afterward, mirroring
 * how a fresh Resource starts with no department assignment (a separate,
 * subsequent call), not a single combined create-and-assign endpoint.
 */
export async function createRole(input: CreateRoleRequest): Promise<RoleResponse> {
  await assertNoCodeConflict(input.code);

  try {
    const created = await prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
      },
      ...withPermissions,
    });
    return toRoleResponse(created);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A role with the given code already exists.");
    }
    throw dbError;
  }
}

/** GET /api/v1/admin/roles — every role, including system roles (read-only for those; see updateRole). */
export async function listRoles(
  query: ListRolesQuery,
): Promise<{ items: RoleResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const [rows, totalItems] = await Promise.all([
    prisma.role.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withPermissions,
    }),
    prisma.role.count(),
  ]);

  return {
    items: rows.map(toRoleResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/** GET /api/v1/admin/roles/:id. */
export async function getRole(id: string): Promise<RoleResponse> {
  const row = await prisma.role.findUnique({ where: { id }, ...withPermissions });
  if (!row) {
    throw new NotFoundError(`No role exists with id "${id}".`);
  }
  return toRoleResponse(row);
}

/**
 * PATCH /api/v1/admin/roles/:id — name/description only (see
 * updateRoleRequestSchema's own doc comment for why `code`/`is_system`
 * aren't accepted here). Works the same for system and non-system roles —
 * renaming/re-describing ADMIN is harmless, since nothing in this codebase
 * keys authorization off a role's name or code, only off permission codes
 * (§5/§10).
 */
export async function updateRole(id: string, input: UpdateRoleRequest): Promise<RoleResponse> {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No role exists with id "${id}".`);
  }

  const updated = await prisma.role.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    ...withPermissions,
  });
  return toRoleResponse(updated);
}

/**
 * PUT /api/v1/admin/roles/:id/permissions (permission `role.manage`) —
 * replaces the role's full permission set. Every id must reference a real
 * `permissions` row (existence-only check — permissions have no is_active
 * concept to also gate on). Diffs against the current set inside one
 * transaction rather than delete-all-then-recreate, mirroring
 * setCourseDepartments exactly, so untouched rows aren't churned.
 */
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<RoleResponse> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new NotFoundError(`No role exists with id "${roleId}".`);
  }

  const uniqueIds = [...new Set(permissionIds)];
  if (uniqueIds.length > 0) {
    const found = await prisma.permission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((p) => p.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError({
        permission_ids: [`The following permission ids do not exist: ${missing.join(", ")}.`],
      });
    }
  }

  const current = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });
  const currentIds = new Set(current.map((row) => row.permissionId));
  const nextIds = new Set(uniqueIds);
  const toAdd = uniqueIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [
          prisma.rolePermission.deleteMany({
            where: { roleId, permissionId: { in: toRemove } },
          }),
        ]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.rolePermission.createMany({
            data: toAdd.map((permissionId) => ({ roleId, permissionId })),
          }),
        ]
      : []),
  ]);

  return getRole(roleId);
}

/**
 * GET /api/v1/admin/permissions (permission `role.manage`) — the full,
 * code-defined permission catalogue (apps/api/src/db/seed.ts's own
 * `PERMISSIONS` array is the source of truth for what exists; this simply
 * reads the resulting table), for the role-permission-assignment checkbox
 * list. Not paginated — a small, complete, code-bounded set, same reasoning
 * as `listQueryManagers`/`listVisibleResourceCategories`.
 */
export async function listAllPermissions(): Promise<PermissionResponse[]> {
  const rows = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  return rows.map(toPermissionResponse);
}
