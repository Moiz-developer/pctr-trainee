import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";

/**
 * Media purposes / private buckets (SYSTEM_PLAN.md §16 lists six:
 * `avatars`, `course-media`, `resource-files`, `policy-documents`,
 * `announcement-media`, `query-attachments`). `course-media` (admin
 * content), `query-attachments` (Phase 6.2 — a trainee's own ticket
 * attachment), `resource-files` (Phase 5.1 — an admin-authored Resource
 * Library file), `policy-documents` (Phase 5.2 — an admin-authored Policy &
 * Procedures document), and `announcement-media` (Phase 5.3.2 — an
 * announcement's optional banner image / attachment) exist so far; the
 * rest arrive with their own features. `purpose` maps 1:1 to a bucket name.
 */
export const mediaPurposeSchema = z.enum([
  "course-media",
  "query-attachments",
  "resource-files",
  "policy-documents",
  "announcement-media",
]);
export type MediaPurpose = z.infer<typeof mediaPurposeSchema>;

/**
 * POST /api/v1/media/upload-url (SYSTEM_PLAN.md §16 upload flow, step 1).
 * Permission `course.content.manage` (enforced at the route). `filename`/
 * `mime_type`/`size_bytes` are declared values validated against the
 * per-purpose allowlist and size limit; the server re-validates the real
 * object at confirm time. The client never supplies bucket or storage path.
 */
export const createMediaUploadUrlRequestSchema = z.object({
  purpose: mediaPurposeSchema,
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(255),
  size_bytes: z.number().int().positive(),
});
export type CreateMediaUploadUrlRequest = z.infer<typeof createMediaUploadUrlRequestSchema>;

/** `storage_path` is server-computed and echoed back only so the client can call `confirm`. */
export const mediaUploadUrlResponseSchema = z.object({
  upload_url: z.url(),
  storage_path: z.string(),
});
export type MediaUploadUrlResponse = z.infer<typeof mediaUploadUrlResponseSchema>;

/**
 * POST /api/v1/media/confirm (SYSTEM_PLAN.md §16 upload flow, step 5). The
 * server verifies the uploaded object exists and re-checks its real
 * size/content-type before creating the finalized `media_assets` row.
 */
export const confirmMediaUploadRequestSchema = z.object({
  purpose: mediaPurposeSchema,
  storage_path: z.string().min(1).max(512),
  mime_type: z.string().min(1).max(255),
  size_bytes: z.number().int().positive(),
  original_filename: z.string().min(1).max(255),
  checksum: z.string().min(1).max(128).nullable().optional(),
});
export type ConfirmMediaUploadRequest = z.infer<typeof confirmMediaUploadRequestSchema>;

/**
 * Admin-facing media-asset record (result of `confirm`). Deliberately omits
 * `bucket`/`storage_path` — the client only ever needs `id` (to attach the
 * asset to a lesson, or to request an access URL). No URL of any kind.
 */
export const mediaAssetResponseSchema = z.object({
  id: idSchema,
  original_filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  checksum: z.string().nullable(),
  uploaded_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
});
export type MediaAssetResponse = z.infer<typeof mediaAssetResponseSchema>;
export const mediaAssetSuccessResponseSchema = apiSuccessSchema(mediaAssetResponseSchema);

/**
 * GET /api/v1/media/:id/access-url (SYSTEM_PLAN.md §16 read flow, §26). The
 * response is a short-lived signed URL and its expiry — nothing else. No
 * bucket, no storage path, no token field. TTL per §16: video 4h,
 * documents/images 5min.
 */
export const mediaAccessUrlResponseSchema = z.object({
  url: z.url(),
  expires_in: z.number().int().positive(),
  expires_at: isoDateStringSchema,
});
export type MediaAccessUrlResponse = z.infer<typeof mediaAccessUrlResponseSchema>;
export const mediaAccessUrlSuccessResponseSchema = apiSuccessSchema(mediaAccessUrlResponseSchema);

/**
 * PUT /api/v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/media
 * — attach (`media_asset_id`) or detach (`null`) a lesson's media reference.
 * Permission `course.content.manage` (SYSTEM_PLAN.md §16). Separate from
 * lesson create/update (Unit 2.4) so media management stays on its own
 * permission and Unit 2.4's contract is unchanged.
 */
export const setLessonMediaRequestSchema = z.object({
  media_asset_id: idSchema.nullable(),
});
export type SetLessonMediaRequest = z.infer<typeof setLessonMediaRequestSchema>;
