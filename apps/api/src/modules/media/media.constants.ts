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
