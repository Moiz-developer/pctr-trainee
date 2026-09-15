-- CreateTable
CREATE TABLE "course_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_name_key" ON "course_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_slug_key" ON "course_categories"("slug");

-- Backfill: one course_categories row per distinct existing free-text
-- courses.category value, so no existing course loses its category during
-- this migration. Slug is derived deterministically (lowercase, spaces to
-- hyphens) — this project defines no slugification algorithm anywhere
-- (same reasoning departments/courses slugs already rely on client-supplied
-- values), so this is the simplest deterministic transform, good enough for
-- the handful of demo category names that exist today; an admin can rename
-- the slug afterward via the standard update endpoint if desired.
INSERT INTO "course_categories" ("id", "name", "slug", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(),
       "category",
       lower(regexp_replace(trim("category"), '[^a-zA-Z0-9]+', '-', 'g')),
       true,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "courses" WHERE "category" IS NOT NULL) AS distinct_categories;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "category_id" UUID;

-- Backfill each course's new category_id from the matching just-created row.
UPDATE "courses"
SET "category_id" = "course_categories"."id"
FROM "course_categories"
WHERE "courses"."category" = "course_categories"."name";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "courses_category_id_idx" ON "courses"("category_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
