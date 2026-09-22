-- Optional cover image for an assessment (course-media bucket), shown on the trainee
-- assessment card in place of its type icon. Hand-written (not `prisma migrate dev`),
-- per this project's established shadow-DB workaround — see other migrations' headers.
-- Additive only: a nullable column + FK, so every existing assessment simply has no
-- image and keeps its current icon fallback. Mirrors 20260921120000_course_module_image
-- field-for-field (same bucket, same ON DELETE SET NULL, same RLS-widening shape).

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "image_media_id" UUID;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Widens media_assets_select so a trainee can read the media_assets row (and so be
-- issued a signed URL, see media.service.ts getMediaAccessUrl) for a PUBLISHED
-- assessment's image in a course they can access — the same shape as
-- assessments_select's own predicate (status = 'PUBLISHED' AND can_access_course
-- (course_id), 20260911140000_assessments). Admins already read every asset via
-- has_permission('course.content.manage').
--
-- ALTER POLICY replaces the full USING expression, so it is reproduced here in full.
-- The base is the policy AS DEPLOYED (read from pg_policies), which already carries
-- every later addition including 20260921120000_course_module_image's own clause —
-- plus the one new clause at the end. media_assets_insert is unchanged (no new write
-- path: assessment images upload as `course-media`, exactly like module images).

ALTER POLICY media_assets_select ON media_assets USING (
  has_permission('course.content.manage')
  OR has_permission('query.manage')
  OR has_permission('resource.manage')
  OR has_permission('policy.manage')
  OR has_permission('policy.version.activate')
  OR has_permission('announcement.manage')
  OR has_permission('announcement.publish')
  OR has_permission('system.manage')
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
      AND can_view_policy(pv.policy_id)
  )
  OR EXISTS (
    SELECT 1 FROM announcements a
    WHERE (a.attachment_media_id = media_assets.id OR a.image_media_id = media_assets.id)
      AND a.status = 'PUBLISHED'
      AND can_view_announcement(a.id)
  )
  OR EXISTS (
    SELECT 1 FROM course_modules cm
    JOIN courses c ON c.id = cm.course_id
    WHERE cm.image_media_id = media_assets.id
      AND cm.is_active AND c.status = 'PUBLISHED'
      AND can_access_course(c.id)
  )
  OR EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.image_media_id = media_assets.id
      AND a.status = 'PUBLISHED'
      AND can_access_course(a.course_id)
  )
);
