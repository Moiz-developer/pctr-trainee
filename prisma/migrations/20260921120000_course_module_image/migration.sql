-- Optional cover image for a course module (course-media bucket), shown on the
-- admin module list and the trainee chapter cards. Hand-written (not
-- `prisma migrate dev`), per this project's established shadow-DB workaround —
-- see other migrations' headers. Additive only: a nullable column + FK, so
-- every existing module simply has no image and keeps its current fallback.

-- AlterTable
ALTER TABLE "course_modules" ADD COLUMN "image_media_id" UUID;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Widens media_assets_select so a trainee can read the media_assets row (and
-- so be issued a signed URL, see media.service.ts getMediaAccessUrl) for an
-- ACTIVE module's image in a PUBLISHED course they can access — the same
-- shape as the lesson-media and course-thumbnail clauses. Admins already read
-- every asset via has_permission('course.content.manage').
--
-- ALTER POLICY replaces the full USING expression, so it is reproduced here in
-- full. The base is the policy AS DEPLOYED (read from pg_policies), which
-- already carries later additions (system.manage, can_view_policy on policy
-- versions) — plus the one new clause at the end. media_assets_insert is
-- unchanged (no new write path: module images upload as `course-media`).

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
);
