-- Phase 5.3.1 — Announcements: database foundation only (SYSTEM_PLAN.md
-- §14.6/§21). No API/frontend in this migration. Hand-written (not `prisma
-- migrate dev`) per this project's established shadow-DB workaround — see
-- other migrations' headers for why. Table/column/constraint names match
-- Prisma's own generated-SQL conventions, verified against schema.prisma.

-- CreateEnum
CREATE TYPE "announcement_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "announcement_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "announcement_priority" NOT NULL DEFAULT 'NORMAL',
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "attachment_media_id" UUID,
    "image_media_id" UUID,
    "author_id" UUID,
    "status" "announcement_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_status_idx" ON "announcements"("status");

-- CreateIndex
CREATE INDEX "announcements_status_published_at_idx" ON "announcements"("status", "published_at");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_attachment_media_id_fkey" FOREIGN KEY ("attachment_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "announcement_departments" (
    "announcement_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "announcement_departments_pkey" PRIMARY KEY ("announcement_id","department_id")
);

-- CreateIndex
CREATE INDEX "announcement_departments_department_id_idx" ON "announcement_departments"("department_id");

-- AddForeignKey
ALTER TABLE "announcement_departments" ADD CONSTRAINT "announcement_departments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_departments" ADD CONSTRAINT "announcement_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "acknowledged_at" TIMESTAMPTZ(6),
    "dismissed_at" TIMESTAMPTZ(6),

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "announcement_reads_user_id_idx" ON "announcement_reads"("user_id");

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Helper: the one authoritative "can this caller see this announcement,
-- given its department targeting" predicate — byte-for-byte the same shape
-- as can_view_resource() (20260913090000_resources/migration.sql), since
-- §14.6 itself specifies "Resources and Announcements follow the same
-- pattern". SECURITY DEFINER + pinned search_path, so it can read
-- announcement_departments/departments/user_departments regardless of the
-- calling role's own RLS-restricted view of those tables. Deliberately does
-- NOT include the `status = 'PUBLISHED'` check — that stays a separate AND
-- clause in the RLS policy below, mirroring can_access_course()/
-- can_view_resource()'s identical separation.
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
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_announcement(uuid) TO app_api;

-- RLS: extends this project's established per-table policy set with the
-- same conventions used throughout (Phase 2H's enable_rls migration, and
-- every phase since). No API exists yet to enforce any of this — RLS is
-- written now, complete and correct, the same "defense-in-depth ready from
-- day one" precedent already followed by the original Query DB-only
-- migration (20260911150000_query_support wrote `has_permission('query.manage')`
-- policies before any Query route existed).

-- announcements (read: announcement.manage/announcement.publish admins see
-- every status; everyone else sees only PUBLISHED + department-visible
-- rows, mirroring resources_select/courses_select exactly. write
-- (create/update, including a future publish action's own status change):
-- either admin permission — the API layer, not RLS, is what will actually
-- restrict WHICH fields each permission may change, mirroring the
-- policy_versions_update precedent)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_select ON announcements FOR SELECT USING (
  has_permission('announcement.manage')
  OR has_permission('announcement.publish')
  OR (status = 'PUBLISHED' AND can_view_announcement(id))
);
CREATE POLICY announcements_insert ON announcements FOR INSERT WITH CHECK (has_permission('announcement.manage'));
CREATE POLICY announcements_update ON announcements FOR UPDATE USING (
  has_permission('announcement.manage') OR has_permission('announcement.publish')
) WITH CHECK (
  has_permission('announcement.manage') OR has_permission('announcement.publish')
);

-- announcement_departments (read: any authenticated user — needed by
-- can_view_announcement()'s own join, exactly like resource_departments/
-- course_departments; write: department.manage — matches those same
-- tables' precedent of gating "which departments can see this X" by
-- department authority, not the content permission)
ALTER TABLE announcement_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_departments_select ON announcement_departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY announcement_departments_insert ON announcement_departments FOR INSERT WITH CHECK (has_permission('department.manage'));
CREATE POLICY announcement_departments_delete ON announcement_departments FOR DELETE USING (has_permission('department.manage'));

-- announcement_reads (strictly personal read/ack/dismiss state — self-only
-- read/write, same shape as lesson_progress, plus an announcement.manage
-- bypass on SELECT for future admin oversight of acknowledgment rates; no
-- DELETE policy anywhere in this project's append-only-history convention)
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_reads_select ON announcement_reads FOR SELECT USING (
  user_id = auth.uid() OR has_permission('announcement.manage')
);
CREATE POLICY announcement_reads_insert ON announcement_reads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY announcement_reads_update ON announcement_reads FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
