-- Sidebar branding unit. Hand-written (not `prisma migrate dev`), per this
-- project's established shadow-DB workaround — see other migrations'
-- headers. Extends the existing single-row `system_settings` table
-- (20260914090000_system_settings, widened by
-- 20260915090000_general_branding_settings) with two more, independent,
-- nullable logo overrides for the sidebar's two layout states, rather than
-- introducing a second branding structure. NULL means "use the built-in
-- Excellium default asset for that state" (apps/web/public/brand/) — these
-- two columns never fall back to platform_logo_media_id.

ALTER TABLE "system_settings"
  ADD COLUMN "sidebar_expanded_logo_media_id" UUID,
  ADD COLUMN "sidebar_collapsed_logo_media_id" UUID;

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_sidebar_expanded_logo_media_id_fkey" FOREIGN KEY ("sidebar_expanded_logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_sidebar_collapsed_logo_media_id_fkey" FOREIGN KEY ("sidebar_collapsed_logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Widen the public branding read (20260915090000_general_branding_settings)
-- with the same bucket/path shape already used for the other three logo
-- slots — the sidebar renders for authenticated users only, but branding as
-- a whole is already fetched once, application-wide, through this one public
-- endpoint (BrandingProvider.tsx), so this follows that existing shape
-- rather than adding a second, auth-only branding read.
--
-- The OUT-parameter row shape changed (four more bucket/path columns), which
-- Postgres won't allow via plain CREATE OR REPLACE — the function must be
-- dropped first.
DROP FUNCTION IF EXISTS public.get_public_branding();

CREATE FUNCTION public.get_public_branding()
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
  login_logo_path text,
  sidebar_expanded_logo_bucket text,
  sidebar_expanded_logo_path text,
  sidebar_collapsed_logo_bucket text,
  sidebar_collapsed_logo_path text
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
    llm.storage_path,
    selm.bucket,
    selm.storage_path,
    sclm.bucket,
    sclm.storage_path
  FROM system_settings s
  LEFT JOIN media_assets lm ON lm.id = s.platform_logo_media_id
  LEFT JOIN media_assets fm ON fm.id = s.favicon_media_id
  LEFT JOIN media_assets llm ON llm.id = s.login_logo_media_id
  LEFT JOIN media_assets selm ON selm.id = s.sidebar_expanded_logo_media_id
  LEFT JOIN media_assets sclm ON sclm.id = s.sidebar_collapsed_logo_media_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_branding() TO app_api;
