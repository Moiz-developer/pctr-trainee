import type {
  GrantResourceAccessRequest,
  ListResourceAccessQuery,
  ResourceAccessResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { ResourceAccess } from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

/**
 * Consistent granular access control unit: explicit per-user Resource
 * access grants. Mirrors course-access.service.ts function-for-function —
 * same soft-revocable, idempotent-and-reactivating grant/revoke shape, same
 * `grantedBy`/`revokedBy`-always-from-the-authenticated-identity rule.
 */

function toResponse(access: ResourceAccess): ResourceAccessResponse {
  return {
    id: access.id,
    resource_id: access.resourceId,
    user_id: access.userId,
    granted_by: access.grantedBy,
    granted_at: access.grantedAt.toISOString(),
    revoked_by: access.revokedBy,
    revoked_at: access.revokedAt ? access.revokedAt.toISOString() : null,
    is_active: access.revokedAt === null,
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

/**
 * POST /api/v1/admin/resources/:resourceId/access (permission
 * `resource.manage`). `resource_access` has UNIQUE(resource_id, user_id) —
 * mirrors `grantCourseAccess`'s exact one-row-per-pairing reactivation
 * logic: no existing row -> create (201); existing active row -> idempotent
 * no-op (200); existing revoked row -> reactivate the same row (200).
 */
export async function grantResourceAccess(
  resourceId: string,
  input: GrantResourceAccessRequest,
  grantedBy: string,
): Promise<{ response: ResourceAccessResponse; status: 200 | 201 }> {
  await assertResourceExists(resourceId);

  const targetUser = await prisma.profile.findUnique({
    where: { id: input.user_id },
    select: { id: true },
  });
  if (!targetUser) {
    throw new NotFoundError(`No user exists with id "${input.user_id}".`);
  }

  const existing = await prisma.resourceAccess.findUnique({
    where: { resourceId_userId: { resourceId, userId: input.user_id } },
  });

  if (!existing) {
    const created = await prisma.resourceAccess.create({
      data: { resourceId, userId: input.user_id, grantedBy },
    });
    return { response: toResponse(created), status: 201 };
  }

  if (existing.revokedAt === null) {
    return { response: toResponse(existing), status: 200 };
  }

  const reactivated = await prisma.resourceAccess.update({
    where: { id: existing.id },
    data: { grantedBy, grantedAt: new Date(), revokedBy: null, revokedAt: null },
  });
  return { response: toResponse(reactivated), status: 200 };
}

/**
 * DELETE /api/v1/admin/resources/:resourceId/access/:userId — soft revoke
 * only, mirrors `revokeCourseAccess` exactly (re-revoking an already-revoked
 * grant is a deterministic no-op preserving the original revocation).
 */
export async function revokeResourceAccess(
  resourceId: string,
  userId: string,
  revokedBy: string,
): Promise<ResourceAccessResponse> {
  await assertResourceExists(resourceId);

  const existing = await prisma.resourceAccess.findUnique({
    where: { resourceId_userId: { resourceId, userId } },
  });
  if (!existing) {
    throw new NotFoundError(
      `No resource access grant exists for user "${userId}" on resource "${resourceId}".`,
    );
  }

  if (existing.revokedAt !== null) {
    return toResponse(existing);
  }

  const revoked = await prisma.resourceAccess.update({
    where: { id: existing.id },
    data: { revokedBy, revokedAt: new Date() },
  });
  return toResponse(revoked);
}

/**
 * GET /api/v1/admin/resources/:resourceId/access — paginated, both active
 * and revoked grants (an admin audit-style view), ordered by `granted_at`
 * desc then `id` — mirrors `listCourseAccess` exactly.
 */
export async function listResourceAccess(
  resourceId: string,
  query: ListResourceAccessQuery,
): Promise<{ items: ResourceAccessResponse[]; meta: PaginationMeta }> {
  await assertResourceExists(resourceId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { resourceId };

  const [rows, totalItems] = await Promise.all([
    prisma.resourceAccess.findMany({
      where,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.resourceAccess.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
