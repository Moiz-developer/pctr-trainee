-- Phase 6.2: Trainer Create Query — lets a trainee upload their own ticket
-- attachment via the existing media upload/confirm flow (media.service.ts,
-- now purpose-aware over `course-media` and the new `query-attachments`
-- bucket). Enable ROW LEVEL SECURITY was already on `media_assets`
-- (Phase 2H); its `select`/`insert` policies only ever admitted
-- `course.content.manage` admins or a reachable-via-published-lesson path —
-- neither applies to a trainee's own query attachment, so without this
-- migration `confirmMediaUpload` would insert-fail under RLS for any
-- non-admin caller. Widens both policies with a narrow, self-only addition
-- — mirrors the same "acting identity differs from / is the row's own
-- owner, gated by an explicit predicate, not row ownership alone" pattern
-- already used for the Phase 4 assessment-grading RLS bridge
-- (20260911140000_assessments/migration.sql).
--
-- ALTER POLICY replaces the full USING/WITH CHECK expression, so both are
-- reproduced here in full (original clauses unchanged, see
-- 20260911110656_enable_rls/migration.sql) plus the new OR clause.

ALTER POLICY media_assets_select ON media_assets USING (
  has_permission('course.content.manage')
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
);

-- INSERT stays default-deny for everything except the two explicitly
-- allowed paths: an admin uploading course-media, or any authenticated
-- user uploading their OWN query-attachments-bucket file (bucket-scoped so
-- this can never become a backdoor for inserting a fake course-media row
-- without the admin permission).
ALTER POLICY media_assets_insert ON media_assets WITH CHECK (
  has_permission('course.content.manage')
  OR (bucket = 'query-attachments' AND uploaded_by = auth.uid())
);
