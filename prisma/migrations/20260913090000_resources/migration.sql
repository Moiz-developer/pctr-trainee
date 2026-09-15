-- Phase 5.1 — Resources (SYSTEM_PLAN.md §14.5/§20). Hand-written (not
-- `prisma migrate dev`) per this project's established shadow-DB workaround
-- — see other migrations' headers for why. Table/column/constraint names
-- match Prisma's own generated-SQL conventions, verified against
-- schema.prisma.
--
-- resource_categories mirrors course_categories field-for-field (same
-- admin-managed-lookup-table shape, same RLS shape — readable by any
-- authenticated user, since both trainee filtering and admin management
-- need to read it; writes gated by permission).
--
-- resources reuses media_assets for the attached file (never a second
-- storage mechanism) and resource_departments reuses the exact same
-- empty-join-means-global department-visibility shape as
-- course_departments/can_access_course — but WITHOUT a course_access-style
-- explicit per-user grant, since §14.5 defines no such table for resources.
-- `can_view_resource()` is the one authoritative SQL expression of that
-- rule, mirrored on the application side by
-- authorization/access.service.ts's `effectiveResourceVisibilityFilter`
-- (SYSTEM_PLAN.md §12: "RLS policies are literal SQL translations of the
-- same access.service.ts logic the API uses").

-- CreateTable
CREATE TABLE "resource_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_categories_name_key" ON "resource_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "resource_categories_slug_key" ON "resource_categories"("slug");

-- CreateEnum
CREATE TYPE "resource_status" AS ENUM ('PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_by" UUID,
    "status" "resource_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_status_idx" ON "resources"("status");

-- CreateIndex
CREATE INDEX "resources_category_id_idx" ON "resources"("category_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "resource_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "resource_departments" (
    "resource_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "resource_departments_pkey" PRIMARY KEY ("resource_id","department_id")
);

-- CreateIndex
CREATE INDEX "resource_departments_department_id_idx" ON "resource_departments"("department_id");

-- AddForeignKey
ALTER TABLE "resource_departments" ADD CONSTRAINT "resource_departments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_departments" ADD CONSTRAINT "resource_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Helper: the one authoritative "can this caller see this resource, given
-- its department targeting" predicate — mirrors can_access_course exactly
-- (SECURITY DEFINER + pinned search_path, so it can read
-- resource_departments/departments/user_departments regardless of the
-- calling role's own RLS-restricted view of those tables). Deliberately
-- does NOT include the `status = 'PUBLISHED'` check — that stays a separate
-- AND clause in resources_select/media_assets_select, exactly mirroring how
-- can_access_course() never checks courses.status itself either.
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
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_resource(uuid) TO app_api;

-- Helper: existence-only check for the 404-vs-403 distinction on
-- GET /resources/:id (SYSTEM_PLAN.md §26/§31) — mirrors
-- course_exists/lesson_exists/media_asset_exists/query_exists exactly.
CREATE OR REPLACE FUNCTION public.resource_exists(target_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM resources WHERE id = target_resource_id);
$$;

GRANT EXECUTE ON FUNCTION public.resource_exists(uuid) TO app_api;

-- RLS: extends this project's established per-table policy set with the
-- same conventions used throughout (Phase 2H's enable_rls migration, and
-- every phase since).

-- resource_categories (read: any authenticated user — needed both by the
-- trainee filter dropdown and by admin management, same shape as
-- course_categories_select; write: resource.manage — the one permission
-- gating the whole Resources feature, mirroring query.manage's role for
-- Queries)
ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_categories_select ON resource_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY resource_categories_insert ON resource_categories FOR INSERT WITH CHECK (has_permission('resource.manage'));
CREATE POLICY resource_categories_update ON resource_categories FOR UPDATE USING (has_permission('resource.manage')) WITH CHECK (has_permission('resource.manage'));

-- resources (read: resource.manage admin sees all regardless of status,
-- OR PUBLISHED + department-visible per can_view_resource(); write:
-- resource.manage — matches admin-resources.routes.ts)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY resources_select ON resources FOR SELECT USING (
  has_permission('resource.manage')
  OR (status = 'PUBLISHED' AND can_view_resource(id))
);
CREATE POLICY resources_insert ON resources FOR INSERT WITH CHECK (has_permission('resource.manage'));
CREATE POLICY resources_update ON resources FOR UPDATE USING (has_permission('resource.manage')) WITH CHECK (has_permission('resource.manage'));

-- resource_departments (read: any authenticated user — needed by
-- can_view_resource()'s own join, exactly like course_departments_select's
-- identical reasoning for can_access_course(); write: department.manage —
-- matches course_departments' own precedent of gating "which departments
-- can see this X" by the department-authority permission, not the content
-- permission)
ALTER TABLE resource_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_departments_select ON resource_departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY resource_departments_insert ON resource_departments FOR INSERT WITH CHECK (has_permission('department.manage'));
CREATE POLICY resource_departments_delete ON resource_departments FOR DELETE USING (has_permission('department.manage'));
