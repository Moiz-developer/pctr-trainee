import type {
  GrantPolicyAccessRequest,
  ListPolicyAccessQuery,
  PolicyAccessResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { PolicyAccess } from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

/**
 * Explicit per-user Policy access grants. Mirrors resource-access.service.ts
 * function-for-function — same soft-revocable, idempotent-and-reactivating
 * grant/revoke shape, same `grantedBy`/`revokedBy`-always-from-the-
 * authenticated-identity rule. Whether a grant actually confers visibility
 * is decided in one place only: `effectivePolicyVisibilityFilter`
 * (authorization/access.service.ts) and its RLS twin `can_view_policy()`.
 */

function toResponse(access: PolicyAccess): PolicyAccessResponse {
  return {
    id: access.id,
    policy_id: access.policyId,
    user_id: access.userId,
    granted_by: access.grantedBy,
    granted_at: access.grantedAt.toISOString(),
    revoked_by: access.revokedBy,
    revoked_at: access.revokedAt ? access.revokedAt.toISOString() : null,
    is_active: access.revokedAt === null,
  };
}

async function assertPolicyExists(policyId: string): Promise<void> {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    select: { id: true },
  });
  if (!policy) {
    throw new NotFoundError(`No policy exists with id "${policyId}".`);
  }
}

/**
 * POST /api/v1/admin/policies/:policyId/access (permission `policy.manage`).
 * `policy_access` has UNIQUE(policy_id, user_id) — no existing row -> create
 * (201); existing active row -> idempotent no-op (200); existing revoked row
 * -> reactivate the same row (200).
 */
export async function grantPolicyAccess(
  policyId: string,
  input: GrantPolicyAccessRequest,
  grantedBy: string,
): Promise<{ response: PolicyAccessResponse; status: 200 | 201 }> {
  await assertPolicyExists(policyId);

  const targetUser = await prisma.profile.findUnique({
    where: { id: input.user_id },
    select: { id: true },
  });
  if (!targetUser) {
    throw new NotFoundError(`No user exists with id "${input.user_id}".`);
  }

  const existing = await prisma.policyAccess.findUnique({
    where: { policyId_userId: { policyId, userId: input.user_id } },
  });

  if (!existing) {
    const created = await prisma.policyAccess.create({
      data: { policyId, userId: input.user_id, grantedBy },
    });
    return { response: toResponse(created), status: 201 };
  }

  if (existing.revokedAt === null) {
    return { response: toResponse(existing), status: 200 };
  }

  const reactivated = await prisma.policyAccess.update({
    where: { id: existing.id },
    data: { grantedBy, grantedAt: new Date(), revokedBy: null, revokedAt: null },
  });
  return { response: toResponse(reactivated), status: 200 };
}

/**
 * DELETE /api/v1/admin/policies/:policyId/access/:userId — soft revoke only
 * (re-revoking an already-revoked grant is a deterministic no-op preserving
 * the original revocation).
 */
export async function revokePolicyAccess(
  policyId: string,
  userId: string,
  revokedBy: string,
): Promise<PolicyAccessResponse> {
  await assertPolicyExists(policyId);

  const existing = await prisma.policyAccess.findUnique({
    where: { policyId_userId: { policyId, userId } },
  });
  if (!existing) {
    throw new NotFoundError(
      `No policy access grant exists for user "${userId}" on policy "${policyId}".`,
    );
  }

  if (existing.revokedAt !== null) {
    return toResponse(existing);
  }

  const revoked = await prisma.policyAccess.update({
    where: { id: existing.id },
    data: { revokedBy, revokedAt: new Date() },
  });
  return toResponse(revoked);
}

/**
 * GET /api/v1/admin/policies/:policyId/access — paginated, both active and
 * revoked grants (an admin audit-style view), ordered by `granted_at` desc
 * then `id`.
 */
export async function listPolicyAccess(
  policyId: string,
  query: ListPolicyAccessQuery,
): Promise<{ items: PolicyAccessResponse[]; meta: PaginationMeta }> {
  await assertPolicyExists(policyId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { policyId };

  const [rows, totalItems] = await Promise.all([
    prisma.policyAccess.findMany({
      where,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.policyAccess.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
