-- Phase 2H follow-up, discovered during live verification of the enable_rls
-- migration: three existing service functions (user-courses.service.ts's
-- getUserCourseDetail, progress.service.ts's loadAuthorizedLesson,
-- media.service.ts's getMediaAccessUrl) each distinguish "genuinely doesn't
-- exist" (404) from "exists but the caller lacks access" (403 — SYSTEM_PLAN.md
-- §26/§31's deliberate rule) by first running a plain `findUnique`/`findFirst`
-- with NO access filter, then separately checking access. Under RLS, that
-- first lookup is now ITSELF filtered by the courses_select/course_lessons_select/
-- media_assets_select policies — so a row the caller cannot access no longer
-- comes back at all, collapsing the intended 403 into a 404 and silently
-- changing existing, tested API behavior (verified live: GET /courses/:id
-- for an unauthorized-but-real course returned 404, not the expected 403).
--
-- These three functions restore the original distinction without weakening
-- RLS at all: each returns ONLY a boolean ("does a row with this id exist,
-- full stop") via SECURITY DEFINER, never any row content — there is
-- nothing here for an unauthorized caller to learn beyond what a 403
-- response already necessarily reveals (that *some* row exists at that id).
-- The actual protected data (course/lesson/media fields) still only ever
-- flows through the normal RLS-filtered query.

CREATE OR REPLACE FUNCTION public.course_exists(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM courses WHERE id = target_course_id);
$$;

CREATE OR REPLACE FUNCTION public.lesson_exists(target_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM course_lessons WHERE id = target_lesson_id);
$$;

CREATE OR REPLACE FUNCTION public.media_asset_exists(target_media_asset_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM media_assets WHERE id = target_media_asset_id);
$$;

GRANT EXECUTE ON FUNCTION public.course_exists(uuid) TO app_api;
GRANT EXECUTE ON FUNCTION public.lesson_exists(uuid) TO app_api;
GRANT EXECUTE ON FUNCTION public.media_asset_exists(uuid) TO app_api;
