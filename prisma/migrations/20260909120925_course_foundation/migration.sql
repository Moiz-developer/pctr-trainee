-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_media_id" UUID,
    "category" TEXT,
    "duration_minutes" INTEGER,
    "status" "course_status" NOT NULL DEFAULT 'DRAFT',
    "completion_require_all_lessons" BOOLEAN NOT NULL DEFAULT true,
    "completion_require_practical" BOOLEAN NOT NULL DEFAULT true,
    "completion_require_assessment_pass" BOOLEAN NOT NULL DEFAULT false,
    "completion_min_assessment_score_pct" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_departments" (
    "course_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "course_departments_pkey" PRIMARY KEY ("course_id","department_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "course_departments_department_id_idx" ON "course_departments"("department_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
