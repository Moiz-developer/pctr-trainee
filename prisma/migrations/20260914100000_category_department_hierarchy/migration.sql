-- Department -> Category -> Training Content hierarchy unit. Adds a
-- nullable `department_id` FK to each of the three existing category
-- tables (course_categories, resource_categories, query_categories) — the
-- minimum schema relationship needed for "a category belongs to a
-- department." NULL = a global category, not scoped to any one department,
-- the same "empty/NULL mapping = globally visible" convention every
-- *_departments join table in this project already uses.
--
-- Backward compatibility: every column is added NULL-able with no default
-- required and no backfill — every existing category row gets
-- department_id = NULL (global) automatically, so every existing category
-- (and every course/resource/query that references it) remains exactly as
-- visible/usable as before this migration. ON DELETE SET NULL on all three
-- FKs: deleting a department never deletes or orphans the categories under
-- it, mirroring course_categories.category_id's own ON DELETE SET NULL
-- precedent on Course ("deactivating/archiving a category must never break
-- or delete an existing course").
--
-- No RLS policy changes: course_categories_select/resource_categories_select/
-- query_categories_select (20260911110656_enable_rls,
-- 20260913090000_resources, 20260913190000_query_categories) already allow
-- any authenticated user to read every category row — that stays correct
-- here. Categories are non-sensitive reference/lookup data (name/slug/
-- description), the same reasoning already documented for roles/permissions/
-- departments; the actual protected content (courses/resources/queries
-- themselves) keeps its own, unchanged, department/access-grant-based RLS.
-- Write policies (course_categories_insert/_update etc.) are unaffected by
-- adding a nullable column — same permission-gated shape as before.

-- AlterTable
ALTER TABLE "course_categories" ADD COLUMN "department_id" UUID;

-- CreateIndex
CREATE INDEX "course_categories_department_id_idx" ON "course_categories"("department_id");

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "resource_categories" ADD COLUMN "department_id" UUID;

-- CreateIndex
CREATE INDEX "resource_categories_department_id_idx" ON "resource_categories"("department_id");

-- AddForeignKey
ALTER TABLE "resource_categories" ADD CONSTRAINT "resource_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "query_categories" ADD COLUMN "department_id" UUID;

-- CreateIndex
CREATE INDEX "query_categories_department_id_idx" ON "query_categories"("department_id");

-- AddForeignKey
ALTER TABLE "query_categories" ADD CONSTRAINT "query_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
