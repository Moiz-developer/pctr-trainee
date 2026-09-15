-- Phase 5.3.3 — Trainer Announcement API. Two additions:
--
-- 1. `announcement_exists()` — existence-only helper for the 404-vs-403
--    distinction on `GET /announcements/:id` (SYSTEM_PLAN.md §26/§31).
--    Mirrors `course_exists`/`lesson_exists`/`media_asset_exists`/
--    `query_exists`/`resource_exists` exactly: returns ONLY a boolean via
--    SECURITY DEFINER, never row content. Needed now (not in
--    20260913150000_announcements, the DB-only phase) because this is the
--    first phase with an actual trainee-facing detail endpoint that needs
--    it — the same "existence helpers arrive with the endpoint that needs
--    them" precedent already followed by resource_exists/query_exists.
--
-- 2. Widens media_assets_select to add the trainee-visibility path this
--    project's own prior migration (20260913160000_announcement_media_rls)
--    explicitly deferred to this unit: "the PUBLISHED+department-visible
--    trainee branch ... arrives with that unit, not here." Mirrors the
--    resources/policy_versions EXISTS clauses exactly, just checking BOTH
--    of an announcement's two media references (attachment and image).
--
-- ALTER POLICY replaces the full USING expression, so it is reproduced here
-- in full (all prior clauses unchanged, see 20260911110656_enable_rls,
-- 20260911160000_query_attachment_media_rls,
-- 20260912110000_admin_query_attachment_view_rls,
-- 20260913091000_resource_media_rls, 20260913121000_policy_media_rls, and
-- 20260913160000_announcement_media_rls) plus the one new clause.
-- media_assets_insert is unchanged by this migration (no new write path).

CREATE OR REPLACE FUNCTION public.announcement_exists(target_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM announcements WHERE id = target_announcement_id);
$$;

GRANT EXECUTE ON FUNCTION public.announcement_exists(uuid) TO app_api;

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
  OR EXISTS (
    SELECT 1 FROM announcements a
    WHERE (a.attachment_media_id = media_assets.id OR a.image_media_id = media_assets.id)
      AND a.status = 'PUBLISHED'
      AND can_view_announcement(a.id)
  )
);
