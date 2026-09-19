-- Explicit per-user Policy access. Hand-written (not `prisma migrate dev`), per
-- this project's established shadow-DB workaround — see other migrations'
-- headers. Additive only: one new table + RLS, and one function widened in place.
--
-- Summary:
--   1. `policy_access` — byte-for-byte the same shape as `resource_access`
--      (20260914110000_granular_access_control/migration.sql): soft-revocable,
--      one row per (policy, user) pairing, `revoked_at IS NULL` = active grant.
--   2. RLS on `policy_access` mirrors `resource_access_*` exactly (select: own
--      grants or the content-manage permission; write: that permission —
--      `policy.manage`, the permission already gating all Policy administration).
--   3. `can_view_policy()` is widened via CREATE OR REPLACE (same function, same
--      signature) with an explicit-grant EXISTS clause, mirroring
--      `can_view_resource()`'s third clause. It is the single predicate already
--      used by `policies_select`, `policy_versions_select` and
--      `media_assets_select`, so no ALTER POLICY is needed and the private
--      document path (RLS + signed URLs) inherits the new rule automatically.
--      The API-side mirror is `effectivePolicyVisibilityFilter()`.

-- ---------------------------------------------------------------------------
-- policy_access (mirrors resource_access field-for-field)
-- ---------------------------------------------------------------------------

CREATE TABLE "policy_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by" UUID,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "policy_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_access_policy_id_user_id_key" ON "policy_access"("policy_id", "user_id");
CREATE INDEX "policy_access_user_id_idx" ON "policy_access"("user_id");
CREATE INDEX "policy_access_policy_id_idx" ON "policy_access"("policy_id");

ALTER TABLE "policy_access" ADD CONSTRAINT "policy_access_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_access" ADD CONSTRAINT "policy_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_access" ADD CONSTRAINT "policy_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "policy_access" ADD CONSTRAINT "policy_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS: policy_access — mirrors resource_access's own three policies exactly.
-- (Table privileges for app_api come from the schema-wide default privileges
-- set in 20260911110656_enable_rls; the browser/anon roles get nothing.)
-- ---------------------------------------------------------------------------

ALTER TABLE policy_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_access_select ON policy_access FOR SELECT USING (
  user_id = auth.uid() OR has_permission('policy.manage')
);
CREATE POLICY policy_access_insert ON policy_access FOR INSERT WITH CHECK (has_permission('policy.manage'));
CREATE POLICY policy_access_update ON policy_access FOR UPDATE USING (has_permission('policy.manage')) WITH CHECK (has_permission('policy.manage'));

-- ---------------------------------------------------------------------------
-- can_view_policy(): department visibility OR an active explicit grant.
-- Clauses 1-2 are unchanged from 20260914110000_granular_access_control;
-- clause 3 is new. A revoked grant (revoked_at IS NOT NULL) matches nothing.
-- ---------------------------------------------------------------------------

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
    )
    OR EXISTS (
      SELECT 1 FROM policy_access pa
      WHERE pa.policy_id = target_policy_id
        AND pa.user_id = auth.uid()
        AND pa.revoked_at IS NULL
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_policy(uuid) TO app_api;
