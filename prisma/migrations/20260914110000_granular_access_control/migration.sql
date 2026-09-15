-- Consistent granular access control for protected training content. Hand-
-- written (not `prisma migrate dev`) per this project's established
-- shadow-DB workaround — see other migrations' headers for why. Table/
-- column/constraint names match Prisma's own generated-SQL conventions,
-- verified against schema.prisma.
--
-- Summary:
--   1. `resource_access` / `announcement_access` — explicit per-user access
--      grant tables, byte-for-byte the same shape as `course_access`
--      (20260909141742_course_access/migration.sql).
--   2. `policy_departments` — department-based visibility for Policies, the
--      same empty-mapping-means-global shape as `resource_departments`/
--      `announcement_departments`/`course_departments`. No explicit
--      per-user grant table for Policies (this unit's own scope: §7 asks
--      only for department-based visibility there).
--   3. `can_view_resource()`/`can_view_announcement()` are widened (via
--      CREATE OR REPLACE, in place — same function, same signature) to add
--      the explicit-grant EXISTS clause, mirroring `can_access_course()`'s
--      own second clause exactly. `can_view_policy()` is new, mirroring
--      `can_view_resource()`'s first two clauses only (no grant branch).
--   4. `policies_select`/`policy_versions_select`/`media_assets_select` are
--      widened (ALTER POLICY) to require `can_view_policy()` for non-admin
--      callers — Policies previously had no department/user access
--      restriction at all (§14.8 defined none); `resources_select`/
--      `announcements_select` need no ALTER POLICY since they already call
--      `can_view_resource()`/`can_view_announcement()`, which are widened
--      in place above.
--   5. `policy_exists_by_slug()` — existence-only 404-vs-403 helper, mirrors
--      `resource_exists`/`announcement_exists` exactly, keyed by slug since
--      `GET /policies/:slug` is (needed now that Policies have a real
--      per-caller visibility boundary for the first time).

-- ---------------------------------------------------------------------------
-- resource_access (mirrors course_access field-for-field)
-- ---------------------------------------------------------------------------

CREATE TABLE "resource_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by" UUID,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "resource_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_access_resource_id_user_id_key" ON "resource_access"("resource_id", "user_id");
CREATE INDEX "resource_access_user_id_idx" ON "resource_access"("user_id");
CREATE INDEX "resource_access_resource_id_idx" ON "resource_access"("resource_id");

ALTER TABLE "resource_access" ADD CONSTRAINT "resource_access_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_access" ADD CONSTRAINT "resource_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_access" ADD CONSTRAINT "resource_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_access" ADD CONSTRAINT "resource_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- announcement_access (mirrors course_access/resource_access field-for-field)
-- ---------------------------------------------------------------------------

CREATE TABLE "announcement_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by" UUID,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "announcement_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "announcement_access_announcement_id_user_id_key" ON "announcement_access"("announcement_id", "user_id");
CREATE INDEX "announcement_access_user_id_idx" ON "announcement_access"("user_id");
CREATE INDEX "announcement_access_announcement_id_idx" ON "announcement_access"("announcement_id");

ALTER TABLE "announcement_access" ADD CONSTRAINT "announcement_access_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_access" ADD CONSTRAINT "announcement_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_access" ADD CONSTRAINT "announcement_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcement_access" ADD CONSTRAINT "announcement_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- policy_departments (mirrors resource_departments/announcement_departments
-- field-for-field — empty mapping = globally visible, no per-user grant)
-- ---------------------------------------------------------------------------

CREATE TABLE "policy_departments" (
    "policy_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "policy_departments_pkey" PRIMARY KEY ("policy_id","department_id")
);

CREATE INDEX "policy_departments_department_id_idx" ON "policy_departments"("department_id");

ALTER TABLE "policy_departments" ADD CONSTRAINT "policy_departments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_departments" ADD CONSTRAINT "policy_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Widen can_view_resource()/can_view_announcement() in place (CREATE OR
-- REPLACE, same signature) to add the explicit-grant EXISTS clause —
-- mirrors can_access_course()'s own second clause exactly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_resource(target_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM resource_departments rd WHERE rd.resource_id = target_resource_id
    )
    OR EXISTS (
      SELECT 1
      FROM resource_departments rd
      JOIN departments d ON d.id = rd.department_id
      JOIN user_departments ud ON ud.department_id = d.id
      WHERE rd.resource_id = target_resource_id
        AND d.is_active = true
        AND ud.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM resource_access ra
      WHERE ra.resource_id = target_resource_id
        AND ra.user_id = auth.uid()
        AND ra.revoked_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_announcement(target_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM announcement_departments ad WHERE ad.announcement_id = target_announcement_id
    )
    OR EXISTS (
      SELECT 1
      FROM announcement_departments ad
      JOIN departments d ON d.id = ad.department_id
      JOIN user_departments ud ON ud.department_id = d.id
      WHERE ad.announcement_id = target_announcement_id
        AND d.is_active = true
        AND ud.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM announcement_access aa
      WHERE aa.announcement_id = target_announcement_id
        AND aa.user_id = auth.uid()
        AND aa.revoked_at IS NULL
    );
$$;

-- New: can_view_policy() — mirrors can_view_resource()'s first two clauses
-- only (no explicit-grant branch, per this unit's §7 scope).
CREATE OR REPLACE FUNCTION public.can_view_policy(target_policy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM policy_departments pd WHERE pd.policy_id = target_policy_id
    )
    OR EXISTS (
      SELECT 1
      FROM policy_departments pd
      JOIN departments d ON d.id = pd.department_id
      JOIN user_departments ud ON ud.department_id = d.id
      WHERE pd.policy_id = target_policy_id
        AND d.is_active = true
        AND ud.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_policy(uuid) TO app_api;

-- Existence-only 404-vs-403 helper for GET /policies/:slug, keyed by slug
-- (unlike resource_exists/announcement_exists, which are keyed by id,
-- because the policy detail route is looked up by slug) — mirrors those
-- exactly otherwise: returns only a boolean via SECURITY DEFINER, never row
-- content. Needed now because policies previously had no per-caller
-- visibility boundary to distinguish a 403 case from at all.
CREATE OR REPLACE FUNCTION public.policy_exists_by_slug(target_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM policies WHERE slug = target_slug);
$$;

GRANT EXECUTE ON FUNCTION public.policy_exists_by_slug(text) TO app_api;

-- ---------------------------------------------------------------------------
-- RLS: resource_access / announcement_access — mirror course_access's own
-- three policies exactly (select: own grants or the content-manage
-- permission; write: the content-manage permission).
-- ---------------------------------------------------------------------------

ALTER TABLE resource_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_access_select ON resource_access FOR SELECT USING (
  user_id = auth.uid() OR has_permission('resource.manage')
);
CREATE POLICY resource_access_insert ON resource_access FOR INSERT WITH CHECK (has_permission('resource.manage'));
CREATE POLICY resource_access_update ON resource_access FOR UPDATE USING (has_permission('resource.manage')) WITH CHECK (has_permission('resource.manage'));

ALTER TABLE announcement_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_access_select ON announcement_access FOR SELECT USING (
  user_id = auth.uid() OR has_permission('announcement.manage')
);
CREATE POLICY announcement_access_insert ON announcement_access FOR INSERT WITH CHECK (has_permission('announcement.manage'));
CREATE POLICY announcement_access_update ON announcement_access FOR UPDATE USING (has_permission('announcement.manage')) WITH CHECK (has_permission('announcement.manage'));

-- ---------------------------------------------------------------------------
-- RLS: policy_departments — mirrors resource_departments/
-- announcement_departments exactly (read: any authenticated user, needed by
-- can_view_policy()'s own join; write: department.manage).
-- ---------------------------------------------------------------------------

ALTER TABLE policy_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_departments_select ON policy_departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policy_departments_insert ON policy_departments FOR INSERT WITH CHECK (has_permission('department.manage'));
CREATE POLICY policy_departments_delete ON policy_departments FOR DELETE USING (has_permission('department.manage'));

-- ---------------------------------------------------------------------------
-- Widen policies_select/policy_versions_select to require can_view_policy()
-- for non-admin callers (ALTER POLICY replaces the full USING expression,
-- reproduced in full here — see 20260913120000_policies/migration.sql for
-- the prior definitions).
-- ---------------------------------------------------------------------------

ALTER POLICY policies_select ON policies USING (
  has_permission('policy.manage')
  OR has_permission('policy.version.activate')
  OR can_view_policy(id)
);

ALTER POLICY policy_versions_select ON policy_versions USING (
  has_permission('policy.manage')
  OR has_permission('policy.version.activate')
  OR (is_active = true AND can_view_policy(policy_id))
);

-- ---------------------------------------------------------------------------
-- Widen media_assets_select's policy_versions clause to also require
-- can_view_policy() for non-admin callers (ALTER POLICY replaces the full
-- USING expression, reproduced in full here — see
-- 20260913170000_announcement_trainee_rls/migration.sql for the prior full
-- definition; only the policy_versions EXISTS clause changes).
-- ---------------------------------------------------------------------------

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
      AND can_view_policy(pv.policy_id)
  )
  OR EXISTS (
    SELECT 1 FROM announcements a
    WHERE (a.attachment_media_id = media_assets.id OR a.image_media_id = media_assets.id)
      AND a.status = 'PUBLISHED'
      AND can_view_announcement(a.id)
  )
);
