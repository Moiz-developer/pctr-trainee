-- Phase 6.7 — Admin Query Management: "View authorized attachments" now
-- has to work for TWO new cases the Phase 6.2 bridge (uploaded_by =
-- auth.uid()) didn't cover, because admins can now reply with their own
-- attachments:
--   1. An admin (permission `query.manage`) viewing ANY attachment on ANY
--      query, including ones a trainee uploaded (uploaded_by = the
--      trainee, not the admin).
--   2. A trainee viewing an attachment an ADMIN uploaded on the trainee's
--      OWN query (uploaded_by = the admin, not the trainee) — e.g. a
--      screenshot the admin attaches to their reply.
-- `queries_update`/`query_messages_select+insert`/`query_attachments_select+insert`
-- already had `has_permission('query.manage')` built in from the original
-- Phase 6 migration (20260911150000_query_support) — this migration only
-- extends `media_assets_select`, the one policy still missing both paths.
-- Same "acting identity differs from the row's uploader, gated by an
-- explicit predicate" pattern as every prior media_assets/RLS bridge in
-- this project (Phase 4 assessment-grading, Phase 6.2 query-attachment
-- upload, Phase 6.6 profiles-for-the-admin-queue).
--
-- ALTER POLICY replaces the full USING expression, so it's reproduced in
-- full here (original clauses unchanged) plus the two new OR clauses.

ALTER POLICY media_assets_select ON media_assets USING (
  has_permission('course.content.manage')
  OR has_permission('query.manage')
  OR uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM course_lessons cl
    JOIN course_modules cm ON cm.id = cl.module_id
    JOIN courses c ON c.id = cm.course_id
    WHERE cl.media_asset_id = media_assets.id
      AND cl.is_active AND cm.is_active AND c.status = 'PUBLISHED'
      AND can_access_course(c.id)
  )
  OR EXISTS (
    SELECT 1 FROM courses c
    WHERE c.thumbnail_media_id = media_assets.id
      AND c.status = 'PUBLISHED'
      AND can_access_course(c.id)
  )
  OR EXISTS (
    SELECT 1 FROM query_attachments qa
    JOIN query_messages qm ON qm.id = qa.query_message_id
    JOIN queries q ON q.id = qm.query_id
    WHERE qa.media_asset_id = media_assets.id
      AND q.user_id = auth.uid()
  )
);
