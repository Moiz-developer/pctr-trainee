-- Phase 3: course_progress, training_sessions, training_hour_requirements
-- (SYSTEM_PLAN.md §14.3/§18). Hand-written (not `prisma migrate dev`) per
-- this project's established shadow-DB workaround — see other migrations'
-- headers for why. Table/column/constraint names below match Prisma's own
-- generated-SQL conventions exactly, verified against schema.prisma.

-- CreateEnum
CREATE TYPE "course_progress_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "training_type" AS ENUM ('THEORETICAL', 'PRACTICAL', 'ASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "training_session_status" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "training_hour_requirement_scope" AS ENUM ('DEPARTMENT', 'USER');

-- CreateTable
CREATE TABLE "course_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "theoretical_progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "practical_progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overall_progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "course_progress_status" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "last_recalculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_user_id_course_id_key" ON "course_progress"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "course_progress_course_id_idx" ON "course_progress"("course_id");

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "lesson_id" UUID,
    "training_type" "training_type" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "status" "training_session_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_sessions_user_id_status_idx" ON "training_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "training_sessions_course_id_idx" ON "training_sessions"("course_id");

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "training_hour_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "training_hour_requirement_scope" NOT NULL,
    "department_id" UUID,
    "user_id" UUID,
    "required_hours" DECIMAL(6,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "training_hour_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_hour_requirements_department_id_effective_from_idx" ON "training_hour_requirements"("department_id", "effective_from");

-- CreateIndex
CREATE INDEX "training_hour_requirements_user_id_effective_from_idx" ON "training_hour_requirements"("user_id", "effective_from");

-- AddForeignKey
ALTER TABLE "training_hour_requirements" ADD CONSTRAINT "training_hour_requirements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_hour_requirements" ADD CONSTRAINT "training_hour_requirements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_hour_requirements" ADD CONSTRAINT "training_hour_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- §14.3: "CHECK: exactly one of department_id/user_id non-null matching scope."
-- Not expressible in Prisma's schema DSL — added here directly.
ALTER TABLE "training_hour_requirements" ADD CONSTRAINT "training_hour_requirements_scope_check" CHECK (
  (scope = 'DEPARTMENT' AND department_id IS NOT NULL AND user_id IS NULL)
  OR (scope = 'USER' AND user_id IS NOT NULL AND department_id IS NULL)
);

-- RLS: extends Phase 2H's per-table policy set (20260911110656_enable_rls)
-- with the same conventions — self-only for the two trainee-owned tables
-- (mirrors lesson_progress exactly, since both are written only by
-- progress.service.ts on behalf of the acting user), admin-write +
-- self-or-relevant-department-read for the admin-configured requirements
-- table.

-- course_progress (self-only read/write; written only by progress.service.ts's recomputeCourseProgress(), never directly by a route handler, but the same self-only policy is correct either way)
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_progress_select ON course_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY course_progress_insert ON course_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY course_progress_update ON course_progress FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- training_sessions (self-only read/write; auto-created/closed by progress.service.ts on behalf of the acting user)
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_sessions_select ON training_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY training_sessions_insert ON training_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY training_sessions_update ON training_sessions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- training_hour_requirements (read: own USER-scope rows, rows for a department the caller belongs to, or training.manage admin; write: training.manage — matches training-hour-requirements.routes.ts)
ALTER TABLE training_hour_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_hour_requirements_select ON training_hour_requirements FOR SELECT USING (
  user_id = auth.uid()
  OR has_permission('training.manage')
  OR (
    department_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_departments ud
      WHERE ud.department_id = training_hour_requirements.department_id
        AND ud.user_id = auth.uid()
    )
  )
);
CREATE POLICY training_hour_requirements_insert ON training_hour_requirements FOR INSERT WITH CHECK (has_permission('training.manage'));
