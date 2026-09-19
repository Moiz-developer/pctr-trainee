-- Security & download-restriction hardening. Hand-written (not `prisma migrate
-- dev`), per this project's established shadow-DB workaround — see other
-- migrations' headers. RESTRICTIVE only: nothing here grants new access.
--
-- The API connects as `app_api` (explicitly granted below and unaffected by
-- any revoke). The browser only ever uses Supabase for authentication and never
-- calls PostgREST/RPC, so removing `anon` (and PUBLIC) execute rights on the
-- helpers below does not change any application behaviour.

-- 1. Prisma's own migration history must not be readable through the Supabase
--    Data API. Prisma migrate connects as the table owner and is unaffected.
REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC, anon, authenticated;

-- 2. SECURITY DEFINER helpers: they were executable by `anon` (via PUBLIC and
--    Supabase's default function privileges), letting anyone with the public
--    anon key probe whether a UUID exists (course_exists, lesson_exists,
--    media_asset_exists, ...) or call has_permission(). Revoke from PUBLIC and
--    `anon` for every SECURITY DEFINER function in `public` EXCEPT
--    get_public_branding() (the intentionally public branding read), then
--    re-grant explicitly to the roles that legitimately evaluate them. Every one
--    of these functions already pins `SET search_path = public` (verified), so
--    no search_path change is needed.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname <> 'get_public_branding'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, app_api', fn.sig);
  END LOOP;
END
$$;

-- 3. Signed-URL lifetimes: the application now also caps them in code (video
--    30 min, documents/images 15 min). Bring the stored settings in line so the
--    Admin Settings page shows the effective values (was 14400s video).
UPDATE system_settings
SET signed_url_ttl_video_seconds = LEAST(signed_url_ttl_video_seconds, 1800),
    signed_url_ttl_default_seconds = LEAST(signed_url_ttl_default_seconds, 900);
