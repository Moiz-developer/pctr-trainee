-- Phase 4: Assessment Engine (SYSTEM_PLAN.md §14.4/§19). Hand-written (not
-- `prisma migrate dev`) per this project's established shadow-DB workaround
-- — see other migrations' headers for why. Table/column/constraint names
-- below match Prisma's own generated-SQL conventions, verified against
-- schema.prisma.

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('QUIZ', 'MOCK_EXAM', 'PRACTICAL', 'TEST', 'OTHER');

-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "assessment_question_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'PRACTICAL_MANUAL');

-- CreateEnum
CREATE TYPE "assessment_attempt_result" AS ENUM ('PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "assessment_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "assessment_type" NOT NULL,
    "total_marks" INTEGER NOT NULL,
    "passing_marks" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "due_date" TIMESTAMPTZ(6),
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "status" "assessment_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_course_id_idx" ON "assessments"("course_id");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "assessment_question_type" NOT NULL,
    "marks" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_questions_assessment_id_sort_order_idx" ON "assessment_questions"("assessment_id", "sort_order");

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "assessment_question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "assessment_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_question_options_question_id_idx" ON "assessment_question_options"("question_id");

-- AddForeignKey
ALTER TABLE "assessment_question_options" ADD CONSTRAINT "assessment_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "score" DECIMAL(6,2),
    "percentage" DECIMAL(5,2),
    "result" "assessment_attempt_result" NOT NULL DEFAULT 'PENDING',
    "status" "assessment_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_assessment_id_user_id_attempt_number_key" ON "assessment_attempts"("assessment_id", "user_id", "attempt_number");

-- CreateIndex
CREATE INDEX "assessment_attempts_user_id_assessment_id_idx" ON "assessment_attempts"("user_id", "assessment_id");

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "answer_text" TEXT,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(6,2),
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ(6),

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_attempt_id_question_id_key" ON "assessment_answers"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "assessment_question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: extends Phase 2H/3's per-table policy set with the same conventions.
-- Read: admin permission, or (for the content tables) PUBLISHED + effective
-- course access, mirroring course_lessons_select exactly. Write: gated by
-- the new `assessment.manage` permission (admin CRUD) or `assessment.grade`
-- (manual grading) — see apps/api/src/db/seed.ts for both.

-- assessments (read: assessment.manage/course.view admin, or PUBLISHED + can_access_course; write: assessment.manage)
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessments_select ON assessments FOR SELECT USING (
  has_permission('assessment.manage')
  OR has_permission('course.view')
  OR (status = 'PUBLISHED' AND can_access_course(course_id))
);
CREATE POLICY assessments_insert ON assessments FOR INSERT WITH CHECK (has_permission('assessment.manage'));
CREATE POLICY assessments_update ON assessments FOR UPDATE USING (has_permission('assessment.manage')) WITH CHECK (has_permission('assessment.manage'));

-- assessment_questions (read: same predicate via parent assessment; write: assessment.manage. Trainee-facing responses redact is_correct at the application layer — RLS is row-level, not column-level — matching §19's "the client never receives correct answers before submission")
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_questions_select ON assessment_questions FOR SELECT USING (
  has_permission('assessment.manage')
  OR has_permission('course.view')
  OR EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_questions.assessment_id
      AND a.status = 'PUBLISHED'
      AND can_access_course(a.course_id)
  )
);
CREATE POLICY assessment_questions_insert ON assessment_questions FOR INSERT WITH CHECK (has_permission('assessment.manage'));
CREATE POLICY assessment_questions_update ON assessment_questions FOR UPDATE USING (has_permission('assessment.manage')) WITH CHECK (has_permission('assessment.manage'));

-- assessment_question_options (same predicate, one join deeper)
ALTER TABLE assessment_question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_question_options_select ON assessment_question_options FOR SELECT USING (
  has_permission('assessment.manage')
  OR has_permission('course.view')
  OR EXISTS (
    SELECT 1 FROM assessment_questions q
    JOIN assessments a ON a.id = q.assessment_id
    WHERE q.id = assessment_question_options.question_id
      AND a.status = 'PUBLISHED'
      AND can_access_course(a.course_id)
  )
);
CREATE POLICY assessment_question_options_insert ON assessment_question_options FOR INSERT WITH CHECK (has_permission('assessment.manage'));
CREATE POLICY assessment_question_options_update ON assessment_question_options FOR UPDATE USING (has_permission('assessment.manage')) WITH CHECK (has_permission('assessment.manage'));

-- assessment_attempts (read/write: attempt owner, or assessment.grade/assessment.manage admin — matches assessment-attempts.service.ts: trainee starts/submits their own, admin grades and views for oversight)
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_attempts_select ON assessment_attempts FOR SELECT USING (
  user_id = auth.uid() OR has_permission('assessment.grade') OR has_permission('assessment.manage')
);
CREATE POLICY assessment_attempts_insert ON assessment_attempts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY assessment_attempts_update ON assessment_attempts FOR UPDATE USING (
  user_id = auth.uid() OR has_permission('assessment.grade')
) WITH CHECK (
  user_id = auth.uid() OR has_permission('assessment.grade')
);

-- assessment_answers (read/write: via the owning attempt's owner, or assessment.grade/assessment.manage admin)
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY assessment_answers_select ON assessment_answers FOR SELECT USING (
  has_permission('assessment.grade')
  OR has_permission('assessment.manage')
  OR EXISTS (SELECT 1 FROM assessment_attempts aa WHERE aa.id = assessment_answers.attempt_id AND aa.user_id = auth.uid())
);
CREATE POLICY assessment_answers_insert ON assessment_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM assessment_attempts aa WHERE aa.id = assessment_answers.attempt_id AND aa.user_id = auth.uid())
);
CREATE POLICY assessment_answers_update ON assessment_answers FOR UPDATE USING (has_permission('assessment.grade')) WITH CHECK (has_permission('assessment.grade'));

-- Integration bridge (§18/§19): recomputeCourseProgress is called from
-- assessment-attempts.service.ts's gradeAssessmentAttempt(), which runs as
-- the GRADING ADMIN, not the trainee whose course_progress/lesson_progress
-- rows are being read/written — the same cross-user-write shape already
-- established by course_access_insert/course-departments (an admin acting
-- on someone else's row, gated by permission, not by row ownership). Widens
-- these four existing Phase 3 policies with the same has_permission(...)
-- OR clause pattern already used throughout this file; nothing about their
-- self-only behavior for a non-grader changes.
ALTER POLICY lesson_progress_select ON lesson_progress USING (user_id = auth.uid() OR has_permission('assessment.grade'));
ALTER POLICY course_progress_select ON course_progress USING (user_id = auth.uid() OR has_permission('assessment.grade'));
ALTER POLICY course_progress_insert ON course_progress WITH CHECK (user_id = auth.uid() OR has_permission('assessment.grade'));
ALTER POLICY course_progress_update ON course_progress USING (user_id = auth.uid() OR has_permission('assessment.grade')) WITH CHECK (user_id = auth.uid() OR has_permission('assessment.grade'));
