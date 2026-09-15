import type { DashboardData } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { effectiveCourseAccessFilter } from "../authorization/access.service.js";
import { getAllocatedHours, getConsumedHours } from "../training-hours/training-hours.service.js";
import {
  listDashboardAnnouncements,
  listPopupAnnouncements,
} from "../announcements/announcements.service.js";

/**
 * GET /api/v1/dashboard (SYSTEM_PLAN.md §26/§40 Phase 3: "dashboard real
 * data (hours, progress, continue learning)"; §26: "aggregates hours,
 * progress, announcements, continue-learning"). Self-scoped only. Reuses
 * `effectiveCourseAccessFilter` (the sole course-access resolver) for the
 * course set, rather than re-deriving "which courses does this user see"
 * independently — the exact same query shape listUserCourses already uses.
 * `announcements`/`popup_announcements` (Phase 5.3.6) reuse
 * announcements.service.ts's own trainee-visibility query/read-state logic
 * wholesale — no second, independently-maintained announcement query here,
 * and no second API endpoint: Portal-open popup logic reads
 * `popup_announcements` off this same response (see
 * PortalAnnouncementPopup.tsx).
 */
export async function getDashboard(
  userId: string,
  departmentIds: string[],
): Promise<DashboardData> {
  const [consumedHours, allocatedHours, accessibleCourses, announcements, popupAnnouncements] =
    await Promise.all([
      getConsumedHours(userId),
      getAllocatedHours(userId, departmentIds),
      prisma.course.findMany({
        where: { status: "PUBLISHED", ...effectiveCourseAccessFilter(userId) },
        select: { id: true, title: true, slug: true },
      }),
      listDashboardAnnouncements(userId),
      listPopupAnnouncements(userId),
    ]);

  const courseIds = accessibleCourses.map((c) => c.id);
  const progressRows =
    courseIds.length === 0
      ? []
      : await prisma.courseProgress.findMany({
          where: { userId, courseId: { in: courseIds } },
        });
  const progressByCourseId = new Map(progressRows.map((row) => [row.courseId, row]));

  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;
  let theoreticalSum = 0;
  let practicalSum = 0;
  for (const course of accessibleCourses) {
    const progress = progressByCourseId.get(course.id);
    const status = progress?.status ?? "NOT_STARTED";
    if (status === "NOT_STARTED") notStarted += 1;
    else if (status === "IN_PROGRESS") inProgress += 1;
    else completed += 1;
    // A course with no course_progress row yet contributes 0%, the same
    // treatment `not_started` above already gives it — not a new rule.
    theoreticalSum += progress ? Number(progress.theoreticalProgressPct) : 0;
    practicalSum += progress ? Number(progress.practicalProgressPct) : 0;
  }
  // Trainer Portal Dashboard spec's "Training Progress" section: one
  // Theoretical and one Practical percentage across all of this trainer's
  // accessible courses — a plain average, the same averaging principle
  // course-progress.service.ts already uses for a single course's own
  // `overall_progress_pct`, applied one level up rather than a new formula.
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const trainingProgress = {
    theoretical_progress_pct:
      accessibleCourses.length === 0 ? 0 : round2(theoreticalSum / accessibleCourses.length),
    practical_progress_pct:
      accessibleCourses.length === 0 ? 0 : round2(practicalSum / accessibleCourses.length),
  };

  const continueLearning = accessibleCourses
    .map((course) => ({ course, progress: progressByCourseId.get(course.id) }))
    .filter(
      (
        entry,
      ): entry is {
        course: (typeof accessibleCourses)[number];
        progress: NonNullable<typeof entry.progress>;
      } => entry.progress?.status === "IN_PROGRESS",
    )
    .sort(
      (a, b) => b.progress.lastRecalculatedAt.getTime() - a.progress.lastRecalculatedAt.getTime(),
    )
    .slice(0, 5)
    .map(({ course, progress }) => ({
      course_id: course.id,
      course_title: course.title,
      course_slug: course.slug,
      overall_progress_pct: Number(progress.overallProgressPct),
      // Real, already-computed values straight off the same `course_progress`
      // row (course-progress.service.ts's recompute logic) — never
      // recalculated here.
      theoretical_progress_pct: Number(progress.theoreticalProgressPct),
      practical_progress_pct: Number(progress.practicalProgressPct),
      status: progress.status,
      last_recalculated_at: progress.lastRecalculatedAt.toISOString(),
    }));

  return {
    hours: { consumed_hours: consumedHours, allocated_hours: allocatedHours },
    courses: {
      total_courses: accessibleCourses.length,
      not_started: notStarted,
      in_progress: inProgress,
      completed,
    },
    training_progress: trainingProgress,
    continue_learning: continueLearning,
    announcements,
    popup_announcements: popupAnnouncements,
  };
}
