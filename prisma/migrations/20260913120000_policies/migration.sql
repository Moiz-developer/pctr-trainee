-- Phase 5.2 — Policy & Procedures (SYSTEM_PLAN.md §14.8/§23). Hand-written
-- (not `prisma migrate dev`) per this project's established shadow-DB
-- workaround — see other migrations' headers for why. Table/column/
-- constraint names match Prisma's own generated-SQL conventions, verified
-- against schema.prisma. `policies.description` is the one field not in
-- §14.8's literal column list — see schema.prisma's own comment for why.

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policies_slug_key" ON "policies"("slug");

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL,
    "version_label" TEXT NOT NULL,
    "media_asset_id" UUID,
    "content" TEXT,
    "effective_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_id_version_label_key" ON "policy_versions"("policy_id", "version_label");

-- CreateIndex
CREATE INDEX "policy_versions_policy_id_is_active_idx" ON "policy_versions"("policy_id", "is_active");

-- The one authoritative "at most one active version per policy" enforcement
-- (§14.8: "guarantees at most one active version per policy at the database
-- level, not just by application discipline"). No Prisma schema DSL
-- equivalent (no partial `where:` on `@@unique`) — expressed here as raw
-- SQL, the same treatment already given to RLS policies throughout this
-- project. Backstops (does not replace) admin-policies.service.ts's own
-- transactional deactivate-then-activate logic.
CREATE UNIQUE INDEX "policy_versions_one_active_per_policy" ON "policy_versions"("policy_id") WHERE "is_active" = true;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: extends this project's established per-table policy set with the
-- same conventions used throughout (Phase 2H's enable_rls migration, and
-- every phase since).

-- policies (read: any authenticated user — plain metadata, no sensitive
-- content of its own; the actual gated content lives on policy_versions.
-- write: policy.manage)
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_select ON policies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY policies_insert ON policies FOR INSERT WITH CHECK (has_permission('policy.manage'));
CREATE POLICY policies_update ON policies FOR UPDATE USING (has_permission('policy.manage')) WITH CHECK (has_permission('policy.manage'));

-- policy_versions (read: policy.manage/policy.version.activate admins see
-- every version incl. archived/draft for history, "§23: admins can browse
-- full history including archived versions for audit purposes" — everyone
-- else sees only is_active = true rows, "non-privileged users' list/detail
-- endpoints always filter is_active=true"; write (create/update, including
-- the activation transaction's own UPDATE): either admin permission — the
-- API layer, not RLS, is what actually restricts WHICH fields each
-- permission may change, mirroring this project's established "RLS is the
-- broader boundary, the API is the precise one" relationship)
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_versions_select ON policy_versions FOR SELECT USING (
  has_permission('policy.manage')
  OR has_permission('policy.version.activate')
  OR is_active = true
);
CREATE POLICY policy_versions_insert ON policy_versions FOR INSERT WITH CHECK (has_permission('policy.manage'));
CREATE POLICY policy_versions_update ON policy_versions FOR UPDATE USING (
  has_permission('policy.manage') OR has_permission('policy.version.activate')
) WITH CHECK (
  has_permission('policy.manage') OR has_permission('policy.version.activate')
);
