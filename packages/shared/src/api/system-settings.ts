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

/** True for any IANA timezone name the runtime's Intl implementation knows (e.g. "Europe/London", "UTC"). */
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// General + Branding field rules (Admin Settings). A stored NULL means "not
// configured — use the built-in PCTR default".
const platformNameSchema = z.string().trim().min(1).max(100);
const platformDescriptionSchema = z.string().trim().min(1).max(500);
const supportEmailSchema = z.email().max(254);
const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, { message: "Unknown timezone." });
const browserTitleSchema = z.string().trim().min(1).max(100);
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #312C85.");

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
  platform_name: z.string().nullable(),
  platform_description: z.string().nullable(),
  support_email: z.string().nullable(),
  timezone: z.string().nullable(),
  browser_title: z.string().nullable(),
  platform_logo_media_id: idSchema.nullable(),
  favicon_media_id: idSchema.nullable(),
  login_logo_media_id: idSchema.nullable(),
  primary_color: z.string().nullable(),
  accent_color: z.string().nullable(),
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
  // General + Branding: `null` clears a value back to the built-in default.
  platform_name: platformNameSchema.nullable().optional(),
  platform_description: platformDescriptionSchema.nullable().optional(),
  support_email: supportEmailSchema.nullable().optional(),
  timezone: timezoneSchema.nullable().optional(),
  browser_title: browserTitleSchema.nullable().optional(),
  platform_logo_media_id: idSchema.nullable().optional(),
  favicon_media_id: idSchema.nullable().optional(),
  login_logo_media_id: idSchema.nullable().optional(),
  primary_color: hexColorSchema.nullable().optional(),
  accent_color: hexColorSchema.nullable().optional(),
});
export type UpdateSystemSettingsRequest = z.infer<typeof updateSystemSettingsRequestSchema>;

/**
 * GET /api/v1/settings/branding — PUBLIC (no auth): the login page needs the
 * platform name, logos and colors before anyone is signed in. Carries only
 * these public branding values; logo/favicon URLs are short-lived signed
 * Storage URLs minted server-side (the buckets stay private), `null` when
 * not configured.
 */
export const publicBrandingResponseSchema = z.object({
  platform_name: z.string().nullable(),
  platform_description: z.string().nullable(),
  support_email: z.string().nullable(),
  browser_title: z.string().nullable(),
  primary_color: z.string().nullable(),
  accent_color: z.string().nullable(),
  logo_url: z.string().nullable(),
  favicon_url: z.string().nullable(),
  login_logo_url: z.string().nullable(),
});
export type PublicBrandingResponse = z.infer<typeof publicBrandingResponseSchema>;

export const publicBrandingDetailResponseSchema = apiSuccessSchema(publicBrandingResponseSchema);

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
