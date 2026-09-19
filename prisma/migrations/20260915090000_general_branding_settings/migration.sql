-- Admin Settings: General + Branding. Hand-written (not `prisma migrate dev`),
-- per this project's established shadow-DB workaround — see other migrations'
-- headers. Extends the existing single-row `system_settings` table
-- (20260914090000_system_settings) rather than adding a second settings
-- structure. Every new column is nullable: NULL means "not configured — the
-- frontend falls back to the built-in PCTR defaults".

ALTER TABLE "system_settings"
  ADD COLUMN "platform_name" TEXT,
  ADD COLUMN "platform_description" TEXT,
  ADD COLUMN "support_email" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "browser_title" TEXT,
  ADD COLUMN "platform_logo_media_id" UUID,
  ADD COLUMN "favicon_media_id" UUID,
  ADD COLUMN "login_logo_media_id" UUID,
  ADD COLUMN "primary_color" TEXT,
  ADD COLUMN "accent_color" TEXT;

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_platform_logo_media_id_fkey" FOREIGN KEY ("platform_logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_favicon_media_id_fkey" FOREIGN KEY ("favicon_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_login_logo_media_id_fkey" FOREIGN KEY ("login_logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Public branding read. The login page needs the platform name/logo/colors
-- BEFORE anyone is authenticated, but `system_settings`/`media_assets` are
-- RLS-gated on `auth.uid()`. Same SECURITY DEFINER pattern as
-- `media_asset_exists()` (20260911111330_rls_existence_helpers): a narrow
-- function returning ONLY the public branding columns (plus the bucket/path
-- the API needs to mint a signed logo URL) — never any other setting.
CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS TABLE (
  platform_name text,
  platform_description text,
  support_email text,
  browser_title text,
  primary_color text,
  accent_color text,
  logo_bucket text,
  logo_path text,
  favicon_bucket text,
  favicon_path text,
  login_logo_bucket text,
  login_logo_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.platform_name,
    s.platform_description,
    s.support_email,
    s.browser_title,
    s.primary_color,
    s.accent_color,
    lm.bucket,
    lm.storage_path,
    fm.bucket,
    fm.storage_path,
    llm.bucket,
    llm.storage_path
  FROM system_settings s
  LEFT JOIN media_assets lm ON lm.id = s.platform_logo_media_id
  LEFT JOIN media_assets fm ON fm.id = s.favicon_media_id
  LEFT JOIN media_assets llm ON llm.id = s.login_logo_media_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO app_api;

-- `branding-assets` uploads (permission `system.manage`, enforced at the API
-- route): widen the media_assets insert/select policies the same way every
-- earlier purpose (resources, policies, announcements) did.
ALTER POLICY media_assets_insert ON media_assets WITH CHECK (
  has_permission('course.content.manage')
  OR has_permission('resource.manage')
  OR has_permission('policy.manage')
  OR has_permission('announcement.manage')
  OR has_permission('system.manage')
  OR (bucket = 'query-attachments' AND uploaded_by = auth.uid())
);

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
);
