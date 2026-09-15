import { z } from "zod";
import { isoDateStringSchema, idSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";

/**
 * Admin Portal / System Settings (SYSTEM_PLAN.md §14.9/§16). A single-row,
 * admin-editable replacement for the previously-hardcoded constants in
 * apps/api/src/modules/media/media.constants.ts (MIME allowlists,
 * per-purpose size limits, signed-URL TTLs) and
 * apps/web/src/pages/portal/courses/VideoLessonPlayer.tsx
 * (VIDEO_COMPLETION_THRESHOLD) — exactly the values those files' own
 * comments already documented as intended to become configurable, and no
 * others. `GET /admin/settings` / `PATCH /admin/settings` (permission
 * `system.manage`) cover the full object; `GET /settings/video-completion-
 * threshold` is a narrow, auth-only (no permission gate) read for trainees,
 * since VideoLessonPlayer.tsx needs this one value to drive auto-completion
 * for every trainee watching a video, not just admins.
 */

const mimeAllowlistSchema = z.array(z.string().min(1)).min(1);

export const systemSettingsResponseSchema = z.object({
  id: idSchema,
  course_media_max_bytes: z.number().int().positive(),
  course_media_mime_allowlist: mimeAllowlistSchema,
  query_attachment_max_bytes: z.number().int().positive(),
  query_attachment_mime_allowlist: mimeAllowlistSchema,
  resource_file_max_bytes: z.number().int().positive(),
  resource_file_mime_allowlist: mimeAllowlistSchema,
  policy_document_max_bytes: z.number().int().positive(),
  policy_document_mime_allowlist: mimeAllowlistSchema,
  announcement_media_max_bytes: z.number().int().positive(),
  announcement_media_mime_allowlist: mimeAllowlistSchema,
  signed_url_ttl_video_seconds: z.number().int().positive(),
  signed_url_ttl_default_seconds: z.number().int().positive(),
  video_completion_threshold: z.number().min(0).max(1),
  updated_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type SystemSettingsResponse = z.infer<typeof systemSettingsResponseSchema>;

export const systemSettingsDetailResponseSchema = apiSuccessSchema(systemSettingsResponseSchema);
export type SystemSettingsDetailResponse = z.infer<typeof systemSettingsDetailResponseSchema>;

/**
 * PATCH /api/v1/admin/settings — every field independently optional
 * (partial update, omit to leave unchanged). `id`/`updated_by`/timestamps
 * are never client-settable.
 */
export const updateSystemSettingsRequestSchema = z.object({
  course_media_max_bytes: z.number().int().positive().optional(),
  course_media_mime_allowlist: mimeAllowlistSchema.optional(),
  query_attachment_max_bytes: z.number().int().positive().optional(),
  query_attachment_mime_allowlist: mimeAllowlistSchema.optional(),
  resource_file_max_bytes: z.number().int().positive().optional(),
  resource_file_mime_allowlist: mimeAllowlistSchema.optional(),
  policy_document_max_bytes: z.number().int().positive().optional(),
  policy_document_mime_allowlist: mimeAllowlistSchema.optional(),
  announcement_media_max_bytes: z.number().int().positive().optional(),
  announcement_media_mime_allowlist: mimeAllowlistSchema.optional(),
  signed_url_ttl_video_seconds: z.number().int().positive().optional(),
  signed_url_ttl_default_seconds: z.number().int().positive().optional(),
  video_completion_threshold: z.number().min(0).max(1).optional(),
});
export type UpdateSystemSettingsRequest = z.infer<typeof updateSystemSettingsRequestSchema>;

/** GET /api/v1/settings/video-completion-threshold — trainee-facing, auth-only. */
export const videoCompletionThresholdResponseSchema = z.object({
  video_completion_threshold: z.number().min(0).max(1),
});
export type VideoCompletionThresholdResponse = z.infer<
  typeof videoCompletionThresholdResponseSchema
>;

export const videoCompletionThresholdDetailResponseSchema = apiSuccessSchema(
  videoCompletionThresholdResponseSchema,
);
export type VideoCompletionThresholdDetailResponse = z.infer<
  typeof videoCompletionThresholdDetailResponseSchema
>;
