-- Admin Role & Permission Management unit (SYSTEM_PLAN.md §5/§10). No
-- schema change: `roles`/`permissions`/`role_permissions` already exist and
-- already have RLS enabled with SELECT policies
-- (20260911110656_enable_rls/migration.sql:104-114) — this migration only
-- adds the missing write policies those tables never got, since nothing
-- ever wrote to them through the RLS-enforced `app_api` role before now
-- (only seed.ts, via the RLS-bypassing `prismaPrivileged` client). Without
-- these, the new admin API's writes would be silently rejected by RLS's own
-- default-deny even though the caller holds `role.manage` and the API-layer
-- check passes — the same "RLS is the broader boundary, the API is the
-- precise one" relationship already established for every other
-- admin-write table, just never previously needed here.
--
-- `permissions` itself gets NO write policy: permission CODES stay
-- seed-defined (apps/api/src/db/seed.ts), never admin-creatable — only
-- which role holds which already-existing permission is dynamic. Writing
-- to `permissions` continues to work only via prismaPrivileged (seed.ts),
-- unchanged.

-- roles (write: role.manage — mirrors departments_insert/departments_update exactly)
CREATE POLICY roles_insert ON roles FOR INSERT WITH CHECK (has_permission('role.manage'));
CREATE POLICY roles_update ON roles FOR UPDATE USING (has_permission('role.manage')) WITH CHECK (has_permission('role.manage'));

-- role_permissions (write: role.manage — mirrors course_departments_insert/
-- course_departments_delete exactly; a pure M:N assignment join table, so a
-- real DELETE on "this role no longer holds this permission" is correct,
-- not a hard-delete-of-content concern)
CREATE POLICY role_permissions_insert ON role_permissions FOR INSERT WITH CHECK (has_permission('role.manage'));
CREATE POLICY role_permissions_delete ON role_permissions FOR DELETE USING (has_permission('role.manage'));
