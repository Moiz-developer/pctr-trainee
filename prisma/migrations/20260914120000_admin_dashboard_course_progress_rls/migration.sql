-- Admin Dashboard real data unit: GET /admin/courses/progress-summary
-- (courses.service.ts's getCourseProgressSummary) runs a plain
-- prisma.courseProgress.count({ where: { status: 'IN_PROGRESS' } }) through
-- the ordinary RLS-enforced app_api role (never prismaPrivileged — that
-- client is reserved for seed.ts/seed-demo.ts only, not request-handling
-- code). Without this widening, course_progress_select's existing USING
-- clause (`user_id = auth.uid() OR has_permission('assessment.grade')`,
-- added by 20260911140000_assessments for the grading-admin case) would
-- silently restrict that count to the calling admin's own rows (effectively
-- zero) for any admin who lacks assessment.grade specifically — an
-- undercounted, not a fabricated, metric, but wrong all the same.
--
-- ALTER POLICY replaces the full USING expression, reproduced here in full
-- (unchanged self-only clause, plus the existing assessment.grade clause)
-- with one new OR branch: has_permission('course.view') — the same
-- permission already gating every other admin read of course data
-- (courses.routes.ts), and the permission the new progress-summary route
-- itself is gated by. Mirrors this exact "widen an existing SELECT policy
-- with an additional has_permission(...) OR branch for a new legitimate
-- admin-read case" pattern 20260911140000_assessments already established
-- for assessment.grade — not a new RLS architecture.
ALTER POLICY course_progress_select ON course_progress USING (
  user_id = auth.uid()
  OR has_permission('assessment.grade')
  OR has_permission('course.view')
);
