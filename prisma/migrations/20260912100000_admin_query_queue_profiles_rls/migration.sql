-- Phase 6.6 — Admin Query Queue: GET /admin/queries (permission
-- `query.manage`) joins each ticket to its submitter's profile
-- (`user_full_name`) so an admin can see WHO filed it — an essential,
-- expected capability of a support queue. `profiles_select`'s original
-- policy (20260911110656_enable_rls) only admits `id = auth.uid()` (self)
-- or `has_permission('user.manage')` — a caller who holds `query.manage`
-- but not `user.manage` (a realistic, intended split per SYSTEM_PLAN.md §5's
-- own permission-table design — "a future TRAINER (instructor), MANAGER,
-- or DEPARTMENT_LEAD role... by inserting rows") would otherwise have the
-- query itself readable but the submitter's name silently missing/blocked
-- by RLS. This is deliberately NOT solved by hard-coding a SUPPORT role —
-- the fix is the same permission-code check already used everywhere else
-- in this file, just widened by one more OR clause. Mirrors the exact same
-- "acting identity needs to read a table it wouldn't otherwise see, gated
-- by a specific permission" pattern as the Phase 4 assessment-grading RLS
-- bridge (20260911140000_assessments/migration.sql) and the Phase 6.2
-- media_assets bridge (20260911160000_query_attachment_media_rls).
--
-- ALTER POLICY replaces the full USING expression, so it's reproduced in
-- full here (original clause unchanged) plus the new OR clause.

ALTER POLICY profiles_select ON profiles USING (
  id = auth.uid()
  OR has_permission('user.manage')
  OR has_permission('query.manage')
);
