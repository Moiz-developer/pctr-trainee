-- Follow-up to 20260914090000_system_settings's seed row: that migration's own INSERT was
-- edited to include the two Excel MIME types in course_media_mime_allowlist (ProtectedFileViewer
-- now supports .xls/.xlsx, see SpreadsheetViewer.tsx), but editing a past migration only changes
-- the default for a database migrated from scratch afterward — it does nothing for a database
-- whose system_settings row was already seeded by the original INSERT. This backfills that row.
--
-- Hand-written (not `prisma migrate dev`), per this project's established shadow-DB workaround —
-- see other migrations' headers.
--
-- Idempotent: each UPDATE's WHERE clause only matches when the value isn't already present, so
-- running this migration (or its statements) more than once never appends a duplicate. Existing
-- values and their order are untouched — a missing value is appended at the end, never inserted
-- or reordered. system_settings is a single-row table (20260914090000_system_settings's own
-- comment), so each statement affects at most one row.

UPDATE "system_settings"
SET "course_media_mime_allowlist" = array_append(
  "course_media_mime_allowlist",
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
)
WHERE NOT (
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = ANY("course_media_mime_allowlist")
);

UPDATE "system_settings"
SET "course_media_mime_allowlist" = array_append(
  "course_media_mime_allowlist",
  'application/vnd.ms-excel'
)
WHERE NOT ('application/vnd.ms-excel' = ANY("course_media_mime_allowlist"));
