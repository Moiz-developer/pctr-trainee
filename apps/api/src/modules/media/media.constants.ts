/**
 * Media configuration for the `course-media`/`query-attachments`/
 * `resource-files`/`policy-documents`/`announcement-media` buckets
 * (SYSTEM_PLAN.md §16).
 *
 * Bucket names and which lesson content types may carry a media asset stay
 * hardcoded here — they're storage/schema identifiers, never named by
 * SYSTEM_PLAN.md §14.9/§16 as configurable. MIME allowlists, per-purpose
 * size limits, and signed-URL TTLs (the values §14.9/§16 DOES name as
 * `system_settings`-configurable) moved to the `system_settings` table —
 * see apps/api/src/modules/settings/settings.service.ts's `getMediaSettings()`,
 * the sole place media.service.ts now reads them from. Defaults are
 * unchanged: the exact numbers/allowlists that used to live here are seeded
 * verbatim by prisma/migrations/20260914090000_system_settings/migration.sql.
 */

/** SYSTEM_PLAN.md §16: private bucket for course/lesson media (and course thumbnails). */
export const COURSE_MEDIA_BUCKET = "course-media";

/** Lesson content types that may carry a media asset (SYSTEM_PLAN.md §14.2). */
export const MEDIA_BACKED_LESSON_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "VIDEO",
  "PDF",
  "DOCUMENT",
  "PRESENTATION",
]);

/** SYSTEM_PLAN.md §16: private bucket for a trainee's own query-ticket attachments (Phase 6.2). */
export const QUERY_ATTACHMENTS_BUCKET = "query-attachments";

/** SYSTEM_PLAN.md §16: private bucket for admin-authored Resource Library files (Phase 5.1). */
export const RESOURCE_FILES_BUCKET = "resource-files";

/** SYSTEM_PLAN.md §16: private bucket for admin-authored Policy & Procedures documents (Phase 5.2). */
export const POLICY_DOCUMENTS_BUCKET = "policy-documents";

/** SYSTEM_PLAN.md §16: private bucket for an announcement's optional attachment/banner image (Phase 5.3.2). */
export const ANNOUNCEMENT_MEDIA_BUCKET = "announcement-media";

/**
 * Private bucket for admin-managed branding images (platform logo, favicon,
 * login logo — Admin Settings: General + Branding, permission `system.manage`).
 * Stays private like every other bucket (SYSTEM_PLAN.md §16); the public
 * `GET /settings/branding` endpoint mints short-lived signed URLs for these.
 */
export const BRANDING_ASSETS_BUCKET = "branding-assets";

/** Branding images are small; a fixed limit/allowlist (not `system_settings`-tunable) is enough. */
export const BRANDING_ASSETS_MAX_BYTES = 2 * 1024 * 1024;
export const BRANDING_ASSETS_MIME_ALLOWLIST: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/**
 * Hard ceilings on signed *download* URL lifetimes, applied on top of the
 * admin-configurable `system_settings` TTLs. A signed URL is a bearer token
 * (anyone holding it can fetch the file until it expires, and it can't be
 * revoked), so these bound that exposure even if a setting is raised.
 */
export const MAX_VIDEO_SIGNED_URL_TTL_SECONDS = 30 * 60;
export const MAX_DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;
