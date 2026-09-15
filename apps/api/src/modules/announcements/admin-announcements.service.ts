import type {
  AdminAnnouncementResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  ListAdminAnnouncementsQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Announcement } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { ANNOUNCEMENT_MEDIA_BUCKET } from "../media/media.constants.js";

/**
 * Admin Announcement API (SYSTEM_PLAN.md §14.6/§21/§26, Phase 5.3.2, admin
 * only — no Trainee API/frontend yet). Two deliberately separate
 * permissions gate this feature, mirroring the exact Policy & Procedures
 * split: `announcement.manage` (create/update/archive/mark-important/
 * department-targeting — see admin-announcements.routes.ts) and the
 * pre-existing `announcement.publish` (the DRAFT -> PUBLISHED transition
 * only, `publishAnnouncement` below). No separate architecture: reuses the
 * exact `media_assets`/signed-URL flow already built for course-media/
 * query-attachments/resource-files/policy-documents (see media.service.ts's
 * purpose-aware upload/confirm).
 */

type AnnouncementWithAuthor = Announcement & { author: { fullName: string } | null };

const withAuthor = {
  include: { author: { select: { fullName: true } } },
} as const;

function toResponse(row: AnnouncementWithAuthor): AdminAnnouncementResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    is_important: row.isImportant,
    show_as_popup: row.showAsPopup,
    attachment_media_id: row.attachmentMediaId,
    image_media_id: row.imageMediaId,
    author_id: row.authorId,
    author_full_name: row.author?.fullName ?? null,
    status: row.status,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * Validates a media asset id references a real, `announcement-media`-bucket
 * asset. Deliberately does NOT check `uploaded_by` — like Resources'
 * `assertResourceFileAsset`/Policies' `assertPolicyDocumentAsset`, an
 * announcement's attachment/image is shared admin-managed content: any
 * `announcement.manage` holder may attach any previously-uploaded
 * announcement-media asset, not only the one they personally uploaded.
 */
async function assertAnnouncementMediaAsset(mediaAssetId: string, field: string): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media || media.bucket !== ANNOUNCEMENT_MEDIA_BUCKET) {
    throw new ValidationError({
      [field]: [`No announcement media exists with id "${mediaAssetId}".`],
    });
  }
}

/**
 * POST /api/v1/admin/announcements (permission `announcement.manage`).
 * `author_id` always comes from the authenticated request identity — never
 * the request body. `status` is never accepted here — every new
 * announcement starts `DRAFT` (the DB default); publishing is the separate,
 * explicit `publishAnnouncement` action.
 */
export async function createAnnouncement(
  authorId: string,
  input: CreateAnnouncementRequest,
): Promise<AdminAnnouncementResponse> {
  if (input.attachment_media_id) {
    await assertAnnouncementMediaAsset(input.attachment_media_id, "attachment_media_id");
  }
  if (input.image_media_id) {
    await assertAnnouncementMediaAsset(input.image_media_id, "image_media_id");
  }

  const created = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.is_important !== undefined ? { isImportant: input.is_important } : {}),
      ...(input.show_as_popup !== undefined ? { showAsPopup: input.show_as_popup } : {}),
      attachmentMediaId: input.attachment_media_id ?? null,
      imageMediaId: input.image_media_id ?? null,
      authorId,
    },
    ...withAuthor,
  });

  return toResponse(created);
}

/** GET /api/v1/admin/announcements — every announcement regardless of status, optionally filtered by status/priority. */
export async function listAdminAnnouncements(
  query: ListAdminAnnouncementsQuery,
): Promise<{ items: AdminAnnouncementResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.priority !== undefined ? { priority: query.priority } : {}),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withAuthor,
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

async function getAnnouncementOrThrow(id: string): Promise<AnnouncementWithAuthor> {
  const row = await prisma.announcement.findUnique({ where: { id }, ...withAuthor });
  if (!row) {
    throw new NotFoundError(`No announcement exists with id "${id}".`);
  }
  return row;
}

/** GET /api/v1/admin/announcements/:id. */
export async function getAdminAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  return toResponse(await getAnnouncementOrThrow(id));
}

/**
 * PATCH /api/v1/admin/announcements/:id — partial update of the
 * announcement's own content, including "mark/unmark Important"
 * (`is_important` is just one more field here, no dedicated endpoint).
 * Never accepts `status`/`published_at` — those change only via
 * `publishAnnouncement`/`archiveAnnouncement`.
 */
export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementRequest,
): Promise<AdminAnnouncementResponse> {
  await getAnnouncementOrThrow(id);

  if (input.attachment_media_id) {
    await assertAnnouncementMediaAsset(input.attachment_media_id, "attachment_media_id");
  }
  if (input.image_media_id) {
    await assertAnnouncementMediaAsset(input.image_media_id, "image_media_id");
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.is_important !== undefined ? { isImportant: input.is_important } : {}),
      ...(input.show_as_popup !== undefined ? { showAsPopup: input.show_as_popup } : {}),
      ...(input.attachment_media_id !== undefined
        ? { attachmentMediaId: input.attachment_media_id }
        : {}),
      ...(input.image_media_id !== undefined ? { imageMediaId: input.image_media_id } : {}),
    },
    ...withAuthor,
  });

  return toResponse(updated);
}

/**
 * POST /api/v1/admin/announcements/:id/publish (permission
 * `announcement.publish` — the one permission SYSTEM_PLAN.md already names
 * for this exact action, §5). Server-validated lifecycle: only a `DRAFT`
 * announcement may be published (rejects an already-`PUBLISHED` or
 * `ARCHIVED` one with 409, rather than silently no-op'ing or re-stamping
 * `published_at`) — sets `status = PUBLISHED` and `published_at = now()`.
 */
export async function publishAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  const existing = await getAnnouncementOrThrow(id);
  if (existing.status !== "DRAFT") {
    throw new ConflictError(
      `Only a DRAFT announcement can be published (current status: ${existing.status}).`,
    );
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    ...withAuthor,
  });

  return toResponse(updated);
}

/**
 * POST /api/v1/admin/announcements/:id/archive (permission
 * `announcement.manage`). Server-validated lifecycle: valid from `DRAFT`
 * (discarding an unpublished draft) or `PUBLISHED` (retiring live content);
 * rejects an already-`ARCHIVED` one with 409 rather than a silent no-op.
 * `published_at` is left untouched — archiving is not un-publishing, it's
 * retiring the historical record of when it *was* published (mirrors
 * Policy versions' own "archived but never deleted" retention).
 */
export async function archiveAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  const existing = await getAnnouncementOrThrow(id);
  if (existing.status === "ARCHIVED") {
    throw new ConflictError("This announcement is already archived.");
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: { status: "ARCHIVED" },
    ...withAuthor,
  });

  return toResponse(updated);
}
