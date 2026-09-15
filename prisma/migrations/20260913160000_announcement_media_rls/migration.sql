-- Phase 5.3.2 — Admin Announcement API: widens media_assets' RLS to cover
-- announcement media uploads/reads — the same bridge pattern used for every
-- prior media_assets RLS migration in this project (Phase 4 assessment-
-- grading, Phase 6.2/6.7 query attachments, Phase 5.1 resource files, Phase
-- 5.2 policy documents):
--   1. INSERT: an admin (permission announcement.manage) uploading an
--      announcement-media-bucket asset (a banner image or attachment) to
--      attach to an announcement.
--   2. SELECT: an announcement.manage/announcement.publish holder previewing
--      any announcement's attachment/image while managing it — deliberately
--      ADMIN-ONLY in this migration, since no Trainee Announcement API or
--      visibility rule exists yet (Phase 5.3.2 is "Admin Announcement API
--      only"); the PUBLISHED+department-visible trainee branch (mirroring
--      resources'/policy_versions' own clauses) arrives with that unit,
--      not here.
--
-- ALTER POLICY replaces the full USING/WITH CHECK expression, so both
-- policies are reproduced here in full (all prior clauses unchanged, see
-- 20260911110656_enable_rls, 20260911160000_query_attachment_media_rls,
-- 20260912110000_admin_query_attachment_view_rls,
-- 20260913091000_resource_media_rls, and 20260913121000_policy_media_rls)
-- plus the new clauses.

ALTER POLICY media_assets_select ON media_assets USING (
  has_permission('course.content.manage')
  OR has_permission('query.manage')
  OR has_permission('resource.manage')
  OR has_permission('policy.manage')
  OR has_permission('policy.version.activate')
  OR has_permission('announcement.manage')
  OR has_permission('announcement.publish')
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
  OR EXISTS (
    SELECT 1 FROM resources r
    WHERE r.media_asset_id = media_assets.id
      AND r.status = 'PUBLISHED'
      AND can_view_resource(r.id)
  )
  OR EXISTS (
    SELECT 1 FROM policy_versions pv
    WHERE pv.media_asset_id = media_assets.id
      AND pv.is_active = true
  )
);

ALTER POLICY media_assets_insert ON media_assets WITH CHECK (
  has_permission('course.content.manage')
  OR has_permission('resource.manage')
  OR has_permission('policy.manage')
  OR has_permission('announcement.manage')
  OR (bucket = 'query-attachments' AND uploaded_by = auth.uid())
);
