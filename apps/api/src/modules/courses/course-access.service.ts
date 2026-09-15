import type {
  GrantCourseAccessRequest,
  ListCourseAccessQuery,
  CourseAccessResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { CourseAccess } from "../../generated/prisma/client.js";
import { NotFoundError } from "../../lib/errors.js";

function toResponse(access: CourseAccess): CourseAccessResponse {
  return {
    id: access.id,
    course_id: access.courseId,
    user_id: access.userId,
    granted_by: access.grantedBy,
    granted_at: access.grantedAt.toISOString(),
    revoked_by: access.revokedBy,
    revoked_at: access.revokedAt ? access.revokedAt.toISOString() : null,
    is_active: access.revokedAt === null,
  };
}

async function assertCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
}

/**
 * POST /api/v1/admin/courses/:courseId/access (SYSTEM_PLAN.md §14.2/§26,
 * permission `course.access.manage`). `course_access` has UNIQUE(course_id,
 * user_id) — "one row per pairing... revocation flips fields rather than
 * inserting a duplicate" (§6). Applying that same one-row-per-pairing rule
 * symmetrically to (re-)granting:
 *   - no existing row -> create one (201).
 *   - existing row, currently active (revoked_at IS NULL) -> idempotent
 *     no-op, return it unchanged (200) — a repeated grant request must not
 *     create a duplicate active grant.
 *   - existing row, currently revoked -> reactivate the SAME row (flip
 *     revoked_at/revoked_by back to null, stamp a fresh granted_at/granted_by)
 *     rather than inserting a second historical row, which the UNIQUE
 *     constraint wouldn't even allow (200).
 * `grantedBy` always comes from the authenticated identity, never the
 * request body — matching the existing anti-impersonation pattern already
 * used for `assigned_by`/`created_by` elsewhere in this codebase.
 */
export async function grantCourseAccess(
  courseId: string,
  input: GrantCourseAccessRequest,
  grantedBy: string,
): Promise<{ response: CourseAccessResponse; status: 200 | 201 }> {
  await assertCourseExists(courseId);

  const targetUser = await prisma.profile.findUnique({
    where: { id: input.user_id },
    select: { id: true },
  });
  if (!targetUser) {
    throw new NotFoundError(`No user exists with id "${input.user_id}".`);
  }

  const existing = await prisma.courseAccess.findUnique({
    where: { courseId_userId: { courseId, userId: input.user_id } },
  });

  if (!existing) {
    const created = await prisma.courseAccess.create({
      data: { courseId, userId: input.user_id, grantedBy },
    });
    return { response: toResponse(created), status: 201 };
  }

  if (existing.revokedAt === null) {
    return { response: toResponse(existing), status: 200 };
  }

  const reactivated = await prisma.courseAccess.update({
    where: { id: existing.id },
    data: { grantedBy, grantedAt: new Date(), revokedBy: null, revokedAt: null },
  });
  return { response: toResponse(reactivated), status: 200 };
}

/**
 * DELETE /api/v1/admin/courses/:courseId/access/:userId (SYSTEM_PLAN.md §26:
 * "soft-revoke; logged" — the plan's own route uses the target user's id,
 * not an opaque access-record id; see this unit's implementation report).
 * Soft revoke only — the row is never deleted. Looking the row up by the
 * (course_id, user_id) compound unique key means a grant that actually
 * belongs to a different course is structurally unreachable through this
 * course's URL — it just won't be found (404), the same hierarchy-integrity
 * behavior established for modules/lessons, achieved here for free by the
 * schema's own uniqueness constraint. Re-revoking an already-revoked grant
 * is a deterministic no-op that returns the existing record unchanged,
 * preserving the original revocation's `revoked_at`/`revoked_by` instead of
 * overwriting real history. `revokedBy` always comes from the authenticated
 * identity, never the request.
 */
export async function revokeCourseAccess(
  courseId: string,
  userId: string,
  revokedBy: string,
): Promise<CourseAccessResponse> {
  await assertCourseExists(courseId);

  const existing = await prisma.courseAccess.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  if (!existing) {
    throw new NotFoundError(
      `No course access grant exists for user "${userId}" on course "${courseId}".`,
    );
  }

  if (existing.revokedAt !== null) {
    return toResponse(existing);
  }

  const revoked = await prisma.courseAccess.update({
    where: { id: existing.id },
    data: { revokedBy, revokedAt: new Date() },
  });
  return toResponse(revoked);
}

/**
 * GET /api/v1/admin/courses/:courseId/access — paginated, ordered
 * deterministically by `granted_at` (most recent first) then `id`. Returns
 * both active and revoked grants — this is an admin audit-style view of a
 * course's explicit access history, not the (out-of-scope) access resolver.
 */
export async function listCourseAccess(
  courseId: string,
  query: ListCourseAccessQuery,
): Promise<{ items: CourseAccessResponse[]; meta: PaginationMeta }> {
  await assertCourseExists(courseId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { courseId };

  const [rows, totalItems] = await Promise.all([
    prisma.courseAccess.findMany({
      where,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseAccess.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/admin/users/:id/course-access (Training Access assignment
 * inside User Management unit) — the user-centric mirror of
 * `listCourseAccess` above: same `course_access` table, same `toResponse`
 * mapper, filtered by `user_id` instead of `course_id`. Backs
 * AdminUsersPage.tsx's new "Training Access" action so an admin can view a
 * user's explicit course grants without leaving the Users page — the
 * existing course-side panel (CourseAccessPanel.tsx, filtered by
 * `course_id` via `listCourseAccess`) is unchanged and still reachable from
 * each course's own admin detail page (§5 of this unit: department-based
 * access stays entirely separate — this only ever touches `course_access`,
 * never `course_departments`/`user_departments`).
 */
export async function listCourseAccessForUser(
  userId: string,
  query: ListCourseAccessQuery,
): Promise<{ items: CourseAccessResponse[]; meta: PaginationMeta }> {
  const user = await prisma.profile.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new NotFoundError(`No user exists with id "${userId}".`);
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { userId };

  const [rows, totalItems] = await Promise.all([
    prisma.courseAccess.findMany({
      where,
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseAccess.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}
