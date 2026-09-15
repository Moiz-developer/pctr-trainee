import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { departmentResponseSchema } from "./departments.js";

/**
 * Announcements (SYSTEM_PLAN.md §14.6/§21/§26). Covers the admin side
 * (Phase 5.3.2 — CRUD, publish, archive, department targeting; two
 * deliberately separate permissions, mirroring the exact Policy &
 * Procedures split: `announcement.manage` for create/update/archive/mark-
 * important/department-targeting, and the pre-existing `announcement.publish`
 * — the plan's own example permission, §5 — reused for ONLY the
 * DRAFT -> PUBLISHED transition) and the trainee side (Phase 5.3.3 —
 * `GET /announcements`, `GET /announcements/:id`, `POST .../ack`,
 * `POST .../dismiss`: only PUBLISHED, department-visible announcements,
 * each carrying this caller's own read/acknowledge/dismiss state).
 */

export const announcementPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH"]);
export type AnnouncementPriority = z.infer<typeof announcementPrioritySchema>;

export const announcementStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;

/**
 * Admin-facing response shape — covers every status (DRAFT/PUBLISHED/
 * ARCHIVED), unlike a future trainee-facing shape which would only ever
 * show PUBLISHED rows. `author_full_name` is a denormalized convenience
 * join (mirrors `AdminQueryResponse.user_full_name`).
 */
export const adminAnnouncementResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  priority: announcementPrioritySchema,
  is_important: z.boolean(),
  show_as_popup: z.boolean(),
  attachment_media_id: idSchema.nullable(),
  image_media_id: idSchema.nullable(),
  author_id: idSchema.nullable(),
  author_full_name: z.string().nullable(),
  status: announcementStatusSchema,
  published_at: isoDateStringSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type AdminAnnouncementResponse = z.infer<typeof adminAnnouncementResponseSchema>;

export const adminAnnouncementListResponseSchema = apiPaginatedSchema(adminAnnouncementResponseSchema);
export type AdminAnnouncementListResponse = z.infer<typeof adminAnnouncementListResponseSchema>;

export const adminAnnouncementDetailResponseSchema = apiSuccessSchema(adminAnnouncementResponseSchema);
export type AdminAnnouncementDetailResponse = z.infer<typeof adminAnnouncementDetailResponseSchema>;

/** GET /api/v1/admin/announcements — filterable by status/priority. */
export const listAdminAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: announcementStatusSchema.optional(),
  priority: announcementPrioritySchema.optional(),
});
export type ListAdminAnnouncementsQuery = z.infer<typeof listAdminAnnouncementsQuerySchema>;

/**
 * POST /api/v1/admin/announcements (permission `announcement.manage`).
 * `author_id` is never client-supplied (always the authenticated identity).
 * `status` is never accepted here — every new announcement starts `DRAFT`
 * (the DB default); publishing is the separate, explicit `.../publish`
 * action (permission `announcement.publish`). `attachment_media_id`/
 * `image_media_id`, when supplied, must reference `announcement-media`-
 * bucket assets (validated server-side, see admin-announcements.service.ts)
 * obtained beforehand via the existing `POST /media/upload-url` +
 * `POST /media/confirm` flow, purpose `announcement-media`.
 */
export const createAnnouncementRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  priority: announcementPrioritySchema.optional(),
  is_important: z.boolean().optional(),
  show_as_popup: z.boolean().optional(),
  attachment_media_id: idSchema.nullable().optional(),
  image_media_id: idSchema.nullable().optional(),
});
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;

/**
 * PATCH /api/v1/admin/announcements/:id — partial update of the
 * announcement's own content (title/body/priority/is_important/
 * show_as_popup/attachment/image) — this is also how "mark/unmark
 * Important" is done (`is_important` is a plain field, not a dedicated
 * endpoint, matching this project's established toggle-via-PATCH
 * convention, e.g. `UpdateResourceCategoryRequest.is_active`). Never
 * accepts `status`/`published_at` — those change only via the dedicated
 * `.../publish` and `.../archive` actions, so a lifecycle transition is
 * always the one explicit, validated action §14.6/§21 describes, never a
 * side effect of an ordinary field edit.
 */
export const updateAnnouncementRequestSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  priority: announcementPrioritySchema.optional(),
  is_important: z.boolean().optional(),
  show_as_popup: z.boolean().optional(),
  attachment_media_id: idSchema.nullable().optional(),
  image_media_id: idSchema.nullable().optional(),
});
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementRequestSchema>;

// ---------------------------------------------------------------------------
// Announcement <-> Department targeting — mirrors
// packages/shared/src/api/resources.ts's resource-department schemas
// field-for-field (same whole-set-replace shape, same department.manage
// permission — §14.6 itself: "Resources and Announcements follow the same
// pattern").
// ---------------------------------------------------------------------------

export const setAnnouncementDepartmentsRequestSchema = z.object({
  department_ids: z.array(idSchema),
});
export type SetAnnouncementDepartmentsRequest = z.infer<
  typeof setAnnouncementDepartmentsRequestSchema
>;

export const announcementDepartmentsResponseSchema = apiSuccessSchema(
  z.array(departmentResponseSchema),
);
export type AnnouncementDepartmentsResponse = z.infer<typeof announcementDepartmentsResponseSchema>;

// ---------------------------------------------------------------------------
// Trainee-facing (Phase 5.3.3, SYSTEM_PLAN.md §26 `GET /announcements`,
// `POST /announcements/:id/ack` — "self"). Only ever returns PUBLISHED,
// department-visible announcements (empty `announcement_departments` =
// global, §14.6/§21) — never a DRAFT/ARCHIVED one, and never one targeted
// at a department this caller doesn't belong to.
// ---------------------------------------------------------------------------

/**
 * This caller's own read/acknowledge/dismiss state for one announcement —
 * `is_read` is derived (`read_at !== null`), not a separate stored column.
 * Absent an `announcement_reads` row at all (never viewed), every field is
 * `null`/`false`.
 */
export const announcementReadStateSchema = z.object({
  is_read: z.boolean(),
  read_at: isoDateStringSchema.nullable(),
  acknowledged_at: isoDateStringSchema.nullable(),
  dismissed_at: isoDateStringSchema.nullable(),
});
export type AnnouncementReadState = z.infer<typeof announcementReadStateSchema>;

/** POST /api/v1/announcements/:id/ack and .../dismiss — the announcement itself never changes, only this caller's own tracking row, so only that is returned. */
export const announcementReadStateResponseSchema = apiSuccessSchema(announcementReadStateSchema);
export type AnnouncementReadStateResponse = z.infer<typeof announcementReadStateResponseSchema>;

/**
 * Trainee-facing response shape — deliberately excludes `author_id`/
 * `status`/nothing-a-trainee-needs-to-manage; keeps `priority`/
 * `is_important`/`show_as_popup` (this phase's own "return important/
 * priority state" requirement) plus this caller's own `read_state`.
 */
export const announcementResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  priority: announcementPrioritySchema,
  is_important: z.boolean(),
  show_as_popup: z.boolean(),
  attachment_media_id: idSchema.nullable(),
  image_media_id: idSchema.nullable(),
  author_full_name: z.string().nullable(),
  published_at: isoDateStringSchema.nullable(),
  read_state: announcementReadStateSchema,
});
export type AnnouncementResponse = z.infer<typeof announcementResponseSchema>;

export const announcementListResponseSchema = apiPaginatedSchema(announcementResponseSchema);
export type AnnouncementListResponse = z.infer<typeof announcementListResponseSchema>;

export const announcementDetailResponseSchema = apiSuccessSchema(announcementResponseSchema);
export type AnnouncementDetailResponse = z.infer<typeof announcementDetailResponseSchema>;

/** GET /api/v1/announcements */
export const listAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;
