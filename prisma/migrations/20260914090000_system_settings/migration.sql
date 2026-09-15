-- Admin Portal / System Settings unit (SYSTEM_PLAN.md §14.9/§16). A
-- single-row, admin-editable replacement for the previously-hardcoded
-- constants in apps/api/src/modules/media/media.constants.ts (MIME
-- allowlists, per-purpose size limits, signed-URL TTLs) and
-- apps/web/src/pages/portal/courses/VideoLessonPlayer.tsx
-- (VIDEO_COMPLETION_THRESHOLD) — exactly the values those files' own
-- comments already documented as intended to become configurable. Bucket
-- names and MEDIA_BACKED_LESSON_CONTENT_TYPES stay hardcoded constants;
-- they were never named as configurable, so they are not touched. Hand-written
-- (not `prisma migrate dev`), per this project's established shadow-DB
-- workaround — see other migrations' headers.

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_media_max_bytes" BIGINT NOT NULL,
    "course_media_mime_allowlist" TEXT[] NOT NULL,
    "query_attachment_max_bytes" BIGINT NOT NULL,
    "query_attachment_mime_allowlist" TEXT[] NOT NULL,
    "resource_file_max_bytes" BIGINT NOT NULL,
    "resource_file_mime_allowlist" TEXT[] NOT NULL,
    "policy_document_max_bytes" BIGINT NOT NULL,
    "policy_document_mime_allowlist" TEXT[] NOT NULL,
    "announcement_media_max_bytes" BIGINT NOT NULL,
    "announcement_media_mime_allowlist" TEXT[] NOT NULL,
    "signed_url_ttl_video_seconds" INTEGER NOT NULL,
    "signed_url_ttl_default_seconds" INTEGER NOT NULL,
    "video_completion_threshold" DECIMAL(3,2) NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the single settings row with the EXACT values every value replaces
-- (media.constants.ts / VideoLessonPlayer.tsx's own prior literals) —
-- requirement: "Keep existing defaults exactly the same." No API ever
-- creates a second row; the application always operates on this one.
INSERT INTO "system_settings" (
  "id",
  "course_media_max_bytes",
  "course_media_mime_allowlist",
  "query_attachment_max_bytes",
  "query_attachment_mime_allowlist",
  "resource_file_max_bytes",
  "resource_file_mime_allowlist",
  "policy_document_max_bytes",
  "policy_document_mime_allowlist",
  "announcement_media_max_bytes",
  "announcement_media_mime_allowlist",
  "signed_url_ttl_video_seconds",
  "signed_url_ttl_default_seconds",
  "video_completion_threshold",
  "updated_at"
) VALUES (
  gen_random_uuid(),
  2147483648, -- 2 GiB, was COURSE_MEDIA_MAX_BYTES
  ARRAY[
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]::text[],
  26214400, -- 25 MiB, was QUERY_ATTACHMENT_MAX_BYTES
  ARRAY[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword', 'text/plain'
  ]::text[],
  104857600, -- 100 MiB, was RESOURCE_FILE_MAX_BYTES
  ARRAY[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain'
  ]::text[],
  52428800, -- 50 MiB, was POLICY_DOCUMENT_MAX_BYTES
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png', 'image/jpeg'
  ]::text[],
  26214400, -- 25 MiB, was ANNOUNCEMENT_MEDIA_MAX_BYTES
  ARRAY[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]::text[],
  14400, -- 4 hours, was SIGNED_URL_TTL_SECONDS.video
  300,   -- 5 minutes, was SIGNED_URL_TTL_SECONDS.default
  0.90,  -- was VIDEO_COMPLETION_THRESHOLD
  now()
);

-- RLS: readable by any authenticated user (mirrors roles_select/
-- permissions_select's own "reference/lookup table, nothing sensitive"
-- reasoning — every value here is an operational limit, not a secret; the
-- narrow trainee-facing endpoint for video_completion_threshold needs this,
-- and the API layer, not RLS, is what limits which fields each endpoint
-- actually returns, per this project's established "RLS is the broader
-- boundary, the API is the precise one" relationship). Write: system.manage.
-- No INSERT/DELETE policy — this table only ever has the one seeded row.
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_settings_select ON system_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY system_settings_update ON system_settings FOR UPDATE USING (has_permission('system.manage')) WITH CHECK (has_permission('system.manage'));
