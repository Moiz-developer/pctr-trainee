import type {
  AnnouncementResponse,
  AnnouncementReadState,
  ListAnnouncementsQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Announcement, AnnouncementRead } from "../../generated/prisma/client.js";
import {
  effectiveAnnouncementVisibilityFilter,
  canViewAnnouncement,
} from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

/**
 * Trainee-facing Announcements (SYSTEM_PLAN.md §14.6/§21/§26 `GET
 * /announcements`, `POST /announcements/:id/ack` — "self"). Deliberately a
 * SEPARATE service/router pair from admin-announcements.service.ts/
 * admin-announcements.routes.ts (Admin management, permission-gated),
 * mirroring resources.service.ts's identical split from
 * admin-resources.service.ts. Only ever returns `PUBLISHED`, department-
 * visible announcements (empty `announcement_departments` = global,
 * §14.6/§21) — visibility is resolved entirely server-side by
 * `effectiveAnnouncementVisibilityFilter`, never a client-supplied filter.
 * User identity is always the authenticated request identity (`userId`
 * parameter, route-derived) — never accepted from the request body/params.
 */

type AnnouncementWithAuthor = Announcement & { author: { fullName: string } | null };

const withAuthor = {
  include: { author: { select: { fullName: true } } },
} as const;

function toReadState(row?: {
  readAt: Date | null;
  acknowledgedAt: Date | null;
  dismissedAt: Date | null;
}): AnnouncementReadState {
  return {
    is_read: !!row?.readAt,
    read_at: row?.readAt ? row.readAt.toISOString() : null,
    acknowledged_at: row?.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    dismissed_at: row?.dismissedAt ? row.dismissedAt.toISOString() : null,
  };
}

function toResponse(
  row: AnnouncementWithAuthor,
  readRow?: { readAt: Date | null; acknowledgedAt: Date | null; dismissedAt: Date | null },
): AnnouncementResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    is_important: row.isImportant,
    show_as_popup: row.showAsPopup,
    attachment_media_id: row.attachmentMediaId,
    image_media_id: row.imageMediaId,
    author_full_name: row.author?.fullName ?? null,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    read_state: toReadState(readRow),
  };
}

/**
 * Batch-fetches this caller's own `announcement_reads` rows for a page of
 * announcement ids in one query (never one query per row) — the same
 * "no N+1 authorization/state lookup" shape as `getCourseProgressMap` in
 * progress-related services.
 */
async function getReadStateMap(
  userId: string,
  announcementIds: string[],
): Promise<Map<string, AnnouncementRead>> {
  if (announcementIds.length === 0) return new Map();
  const rows = await prisma.announcementRead.findMany({
    where: { userId, announcementId: { in: announcementIds } },
  });
  return new Map(rows.map((row) => [row.announcementId, row]));
}

/**
 * Loads a PUBLISHED, visible-to-this-caller announcement, or throws the
 * same 404-vs-403 distinction `getResourceDetail`/`getUserCourseDetail`
 * already establish (SYSTEM_PLAN.md §26/§31): a genuinely nonexistent id is
 * 404; a real id that's DRAFT/ARCHIVED or targeted at a department this
 * caller doesn't belong to is 403, never a silent 404-hide.
 * `announcement_exists` (SECURITY DEFINER, boolean only) restores that
 * distinction, which RLS's own row-hiding would otherwise collapse.
 */
async function getVisibleAnnouncementOrThrow(
  userId: string,
  announcementId: string,
): Promise<AnnouncementWithAuthor> {
  const row = await prisma.announcement.findUnique({
    where: { id: announcementId },
    ...withAuthor,
  });
  if (!row) {
    const [existsRow] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.announcement_exists(${announcementId}::uuid) AS exists`;
    if (!existsRow?.exists) {
      throw new NotFoundError(`No announcement exists with id "${announcementId}".`);
    }
    throw new ForbiddenError();
  }
  if (row.status !== "PUBLISHED") {
    throw new ForbiddenError();
  }
  if (!(await canViewAnnouncement(userId, announcementId))) {
    throw new ForbiddenError();
  }
  return row;
}

/**
 * Upserts this caller's own `announcement_reads` row: creates it (with
 * `read_at` stamped) on first interaction of any kind, or updates it,
 * backfilling `read_at` only if it was still null (never overwriting an
 * earlier first-read timestamp with a later one) while always applying
 * `extraFields` (e.g. `acknowledgedAt`/`dismissedAt`). This is the one
 * place any `announcement_reads` write happens — list/detail reads never
 * write, only this function does, and only in response to an actual
 * trainee interaction (viewing the detail, or explicitly acknowledging/
 * dismissing) — never as a side effect of the list endpoint.
 */
async function recordAnnouncementInteraction(
  userId: string,
  announcementId: string,
  extraFields: Partial<{ acknowledgedAt: Date; dismissedAt: Date }> = {},
): Promise<AnnouncementRead> {
  const existing = await prisma.announcementRead.findUnique({
    where: { announcementId_userId: { announcementId, userId } },
  });
  const now = new Date();

  if (!existing) {
    return prisma.announcementRead.create({
      data: { announcementId, userId, readAt: now, ...extraFields },
    });
  }

  return prisma.announcementRead.update({
    where: { id: existing.id },
    data: {
      ...(existing.readAt ? {} : { readAt: now }),
      ...extraFields,
    },
  });
}

/**
 * GET /api/v1/announcements (SYSTEM_PLAN.md §26): only `PUBLISHED`
 * announcements the caller can see. Uses `effectiveAnnouncementVisibilityFilter`
 * — the exact predicate `canViewAnnouncement()` is composed from — as a
 * single bulk WHERE clause, the same "no N+1 authorization" shape as
 * `listUserCourses`/`listResources`. Read-only: viewing the list never
 * marks anything read (only opening the detail, or an explicit ack/dismiss,
 * does that) — so "unread" counts/badges built from this endpoint stay
 * meaningful.
 */
export async function listAnnouncements(
  userId: string,
  query: ListAnnouncementsQuery,
): Promise<{ items: AnnouncementResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    status: "PUBLISHED" as const,
    ...effectiveAnnouncementVisibilityFilter(userId),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withAuthor,
    }),
    prisma.announcement.count({ where }),
  ]);

  const readStateMap = await getReadStateMap(
    userId,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => toResponse(row, readStateMap.get(row.id))),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/announcements/:id — viewing the detail marks it read (first
 * view only; `recordAnnouncementInteraction` never overwrites an existing
 * `read_at`).
 */
export async function getAnnouncementDetail(
  userId: string,
  announcementId: string,
): Promise<AnnouncementResponse> {
  const row = await getVisibleAnnouncementOrThrow(userId, announcementId);
  const readRow = await recordAnnouncementInteraction(userId, announcementId);
  return toResponse(row, readRow);
}

/**
 * POST /api/v1/announcements/:id/ack — SYSTEM_PLAN.md §26's own literal
 * endpoint ("writes announcement_reads"). Not restricted to
 * `is_important` announcements at the API layer: §14.6 defines
 * `announcement_reads` as a generic per-announcement tracking table with no
 * such gate, and "for important announcements" (this phase's own wording)
 * describes the primary frontend use case, not a hard server-side
 * restriction — acknowledging is harmless and meaningful on any visible
 * announcement.
 */
export async function acknowledgeAnnouncement(
  userId: string,
  announcementId: string,
): Promise<AnnouncementReadState> {
  await getVisibleAnnouncementOrThrow(userId, announcementId);
  const readRow = await recordAnnouncementInteraction(userId, announcementId, {
    acknowledgedAt: new Date(),
  });
  return toReadState(readRow);
}

/**
 * POST /api/v1/announcements/:id/dismiss — the popup-suppression action
 * §14.6 itself describes: "once dismissed, the popup never reappears for
 * that user/announcement pair." Same non-restriction reasoning as
 * `acknowledgeAnnouncement` above.
 */
export async function dismissAnnouncement(
  userId: string,
  announcementId: string,
): Promise<AnnouncementReadState> {
  await getVisibleAnnouncementOrThrow(userId, announcementId);
  const readRow = await recordAnnouncementInteraction(userId, announcementId, {
    dismissedAt: new Date(),
  });
  return toReadState(readRow);
}

/**
 * Phase 5.3.6, corrected by the dashboard audit's confirmed gap #3 —
 * strictly `is_important = true`, `status = PUBLISHED`, department-visible
 * announcements only, for `GET /dashboard`'s own "Important Announcements"
 * section (SYSTEM_PLAN.md §26: "aggregates hours, progress, announcements,
 * continue-learning"). Previously sorted important-first but did NOT
 * filter to important-only, so a mixed "recent" list could fill the
 * remaining slots — this now matches the section's actual name. Reused by
 * dashboard.service.ts rather than a second, independently-maintained
 * visibility query — same `effectiveAnnouncementVisibilityFilter`/
 * `getReadStateMap`/`toResponse` this file's own list/detail endpoints
 * already use; unchanged authorization/visibility logic. Capped via `take`,
 * the same "small top-N summary" shape as `continue_learning`
 * (`slice(0, 5)` in dashboard.service.ts's course logic).
 */
export async function listDashboardAnnouncements(
  userId: string,
  limit = 5,
): Promise<AnnouncementResponse[]> {
  const rows = await prisma.announcement.findMany({
    where: {
      status: "PUBLISHED",
      isImportant: true,
      ...effectiveAnnouncementVisibilityFilter(userId),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    ...withAuthor,
  });
  const readStateMap = await getReadStateMap(
    userId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toResponse(row, readStateMap.get(row.id)));
}

/**
 * Phase 5.3.6 — popup-eligible announcements: SYSTEM_PLAN.md §14.6's own
 * literal popup rule, "`show_as_popup=true`, `status=PUBLISHED`
 * announcements targeted at the user's department(s) where no row exists
 * yet or `dismissed_at` is null — once dismissed, the popup never
 * reappears." This is the ONE place that rule is expressed — embedded in
 * `GET /dashboard`'s response (no second popup endpoint, no client-side
 * localStorage suppression: `dismissed_at` is the same server-tracked fact
 * `dismissAnnouncement` above already writes).
 */
export async function listPopupAnnouncements(userId: string): Promise<AnnouncementResponse[]> {
  const rows = await prisma.announcement.findMany({
    where: {
      status: "PUBLISHED",
      showAsPopup: true,
      ...effectiveAnnouncementVisibilityFilter(userId),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    ...withAuthor,
  });
  if (rows.length === 0) return [];

  const readStateMap = await getReadStateMap(
    userId,
    rows.map((row) => row.id),
  );
  return rows
    .filter((row) => !readStateMap.get(row.id)?.dismissedAt)
    .map((row) => toResponse(row, readStateMap.get(row.id)));
}
