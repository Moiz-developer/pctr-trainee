import type {
  GrantAnnouncementAccessRequest,
  ListAnnouncementAccessQuery,
  AnnouncementAccessResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { AnnouncementAccess } from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

/**
 * Consistent granular access control unit: explicit per-user Announcement
 * access grants. Mirrors resource-access.service.ts (and, before it,
 * course-access.service.ts) function-for-function.
 */

function toResponse(access: AnnouncementAccess): AnnouncementAccessResponse {
  return {
    id: access.id,
    announcement_id: access.announcementId,
    user_id: access.userId,
    granted_by: access.grantedBy,
    granted_at: access.grantedAt.toISOString(),
    revoked_by: access.revokedBy,
    revoked_at: access.revokedAt ? access.revokedAt.toISOString() : null,
    is_active: access.revokedAt === null,
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

/**
 * POST /api/v1/admin/announcements/:announcementId/access (permission
 * `announcement.manage`). `announcement_access` has UNIQUE(announcement_id,
 * user_id) — mirrors `grantResourceAccess`/`grantCourseAccess`'s exact
 * one-row-per-pairing reactivation logic.
 */
export async function grantAnnouncementAccess(
  announcementId: string,
  input: GrantAnnouncementAccessRequest,
  grantedBy: string,
): Promise<{ response: AnnouncementAccessResponse; status: 200 | 201 }> {
  await assertAnnouncementExists(announcementId);

  const targetUser = await prisma.profile.findUnique({
    where: { id: input.user_id },
    select: { id: true },
  });
  if (!targetUser) {
    throw new NotFoundError(`No user exists with id "${input.user_id}".`);
  }

  const existing = await prisma.announcementAccess.findUnique({
    where: { announcementId_userId: { announcementId, userId: input.user_id } },
  });

  if (!existing) {
    const created = await prisma.announcementAccess.create({
      data: { announcementId, userId: input.user_id, grantedBy },
    });
    return { response: toResponse(created), status: 201 };
  }

  if (existing.revokedAt === null) {
    return { response: toResponse(existing), status: 200 };
  }

  const reactivated = await prisma.announcementAccess.update({
    where: { id: existing.id },
    data: { grantedBy, grantedAt: new Date(), revokedBy: null, revokedAt: null },
  });
  return { response: toResponse(reactivated), status: 200 };
}

/**
 * DELETE /api/v1/admin/announcements/:announcementId/access/:userId — soft
 * revoke only, mirrors `revokeResourceAccess`/`revokeCourseAccess` exactly.
 */
export async function revokeAnnouncementAccess(
  announcementId: string,
  userId: string,
  revokedBy: string,
): Promise<AnnouncementAccessResponse> {
  await assertAnnouncementExists(announcementId);

  const existing = await prisma.announcementAccess.findUnique({
    where: { announcementId_userId: { announcementId, userId } },
  });
  if (!existing) {
    throw new NotFoundError(
      `No announcement access grant exists for user "${userId}" on announcement "${announcementId}".`,
    );
  }

  if (existing.revokedAt !== null) {
    return toResponse(existing);
  }

  const revoked = await prisma.announcementAccess.update({
    where: { id: existing.id },
    data: { revokedBy, revokedAt: new Date() },
  });
  return toResponse(revoked);
}

/**
 * GET /api/v1/admin/announcements/:announcementId/access — paginated, both
 * active and revoked grants, mirrors `listResourceAccess`/`listCourseAccess`
 * exactly.
 */
export async function listAnnouncementAccess(
  announcementId: string,
  query: ListAnnouncementAccessQuery,
): Promise<{ items: AnnouncementAccessResponse[]; meta: PaginationMeta }> {
  await assertAnnouncementExists(announcementId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { announcementId };

  const [rows, totalItems] = await Promise.all([
    prisma.announcementAccess.findMany({
      where,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.announcementAccess.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
