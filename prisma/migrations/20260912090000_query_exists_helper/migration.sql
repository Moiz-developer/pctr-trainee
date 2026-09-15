-- Phase 6.4 — Trainer Query Conversation: GET /queries/:id (view a single
-- query's thread) needs the same 404-vs-403 distinction already established
-- for courses/lessons/media (20260911111330_rls_existence_helpers): a
-- genuinely nonexistent query id is 404, but a real query id belonging to
-- someone else is 403 (SYSTEM_PLAN.md §26/§31) — not a 404-hide. Under
-- RLS's self-only `queries_select` policy, a plain `findUnique` for another
-- user's query returns nothing at all, collapsing that intended 403 into a
-- 404 unless this existence-only check exists. Mirrors
-- course_exists/lesson_exists/media_asset_exists exactly: returns ONLY a
-- boolean via SECURITY DEFINER, never row content.

CREATE OR REPLACE FUNCTION public.query_exists(target_query_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM queries WHERE id = target_query_id);
$$;

GRANT EXECUTE ON FUNCTION public.query_exists(uuid) TO app_api;
