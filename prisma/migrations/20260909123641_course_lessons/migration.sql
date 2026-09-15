-- CreateEnum
CREATE TYPE "lesson_content_type" AS ENUM ('VIDEO', 'PDF', 'DOCUMENT', 'PRESENTATION', 'EXTERNAL_LINK', 'TEXT');

-- CreateEnum
CREATE TYPE "lesson_classification" AS ENUM ('THEORETICAL', 'PRACTICAL');

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_type" "lesson_content_type" NOT NULL,
    "media_asset_id" UUID,
    "external_url" TEXT,
    "text_content" TEXT,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "classification" "lesson_classification" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_lessons_module_id_sort_order_idx" ON "course_lessons"("module_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_lessons_classification_idx" ON "course_lessons"("classification");

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
