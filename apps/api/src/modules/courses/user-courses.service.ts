import type {
  ListCourseCatalogueQuery,
  CourseCatalogueItem,
  CourseDetail,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { canAccessCourse, effectiveCourseAccessFilter } from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import {
  getCourseProgressMap,
  toCourseProgressSummary,
} from "../progress/course-progress.service.js";
import { computeBestAssessmentResult } from "../assessments/assessment-attempts.service.js";
import type { CourseProgress } from "../../generated/prisma/client.js";

function toCatalogueItem(
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnailMediaId: string | null;
    category: { name: string } | null;
    durationMinutes: number | null;
    courseDepartments: { department: { id: string; name: string } }[];
  },
  progress: CourseProgress | null | undefined,
): CourseCatalogueItem {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail_media_id: course.thumbnailMediaId,
    // The public catalogue contract keeps `category` as a plain string
    // (unchanged since Unit 2.7) — only the internal source changed, from a
    // free-text column to the related course_categories row's name (Admin
    // Navigation + Dynamic Course Categories unit). No frontend change
    // needed: the shape this function returns is identical to before.
    category: course.category?.name ?? null,
    duration_minutes: course.durationMinutes,
    // Department visibility in the Trainer Portal UI unit: read-only display
    // of the same `course_departments` data `effectiveCourseAccessFilter`
    // already treats as authoritative for access control (empty array =
    // globally visible).
    departments: course.courseDepartments.map((cd) => cd.department),
    // Phase 3: the caller's own course_progress — see course-progress.service.ts.
    progress: toCourseProgressSummary(progress),
  };
}

/**
 * GET /api/v1/courses (SYSTEM_PLAN.md §26): only `PUBLISHED` courses the
 * caller has effective access to (§6/§10). Uses `effectiveCourseAccessFilter`
 * — the same predicate `canAccessCourse` is built from — as a single bulk
 * WHERE clause, rather than fetching every published course and calling
 * `canAccessCourse()` once per row (an N+1 authorization pattern this unit
 * was explicitly told to avoid).
 */
export async function listUserCourses(
  userId: string,
  query: ListCourseCatalogueQuery,
): Promise<{ items: CourseCatalogueItem[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    status: "PUBLISHED" as const,
    ...effectiveCourseAccessFilter(userId),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailMediaId: true,
        category: { select: { name: true } },
        durationMinutes: true,
        // Department visibility in the Trainer Portal UI unit: a plain
        // scalar join, batched into this same query (no extra round trip).
        courseDepartments: { select: { department: { select: { id: true, name: true } } } },
      },
      // Deterministic ordering with an id tiebreaker (SYSTEM_PLAN.md §26/§33)
      // — createdAt alone could tie under stable data across page boundaries.
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  const progressByCourseId = await getCourseProgressMap(
    userId,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => toCatalogueItem(row, progressByCourseId.get(row.id))),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/courses/:id (SYSTEM_PLAN.md §26: "resource-scoped
 * requireCourseAccess", "403 if not authorized, not a 404-hide"; §31:
 * "the API returns 403 (not 404) when the course exists but the user lacks
 * access, and true 404 only when it genuinely doesn't exist"). A DRAFT/
 * ARCHIVED course, or a PUBLISHED course the caller cannot access, is
 * treated identically — the course *exists* but isn't visible to this
 * caller in its current state, so both cases are 403; only a course id
 * that matches no row at all is 404. See this unit's implementation report
 * for why this deliberately does NOT use 404 for "not authorized" despite
 * this unit's own task text repeatedly suggesting 404 — SYSTEM_PLAN.md's
 * own explicit, reasoned rule for exactly this scenario is followed
 * instead. Never returns course/module/lesson data before this check
 * passes.
 */
export async function getUserCourseDetail(userId: string, courseId: string): Promise<CourseDetail> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      category: { select: { name: true } },
      // Department visibility in the Trainer Portal UI unit: same join as
      // listUserCourses above.
      courseDepartments: { select: { department: { select: { id: true, name: true } } } },
    },
  });
  if (!course) {
    // Phase 2H: RLS's own courses_select policy may have hidden this row
    // because the caller lacks course.view/effective access — that's a 403
    // case, not a 404 one (see this function's own doc comment above).
    // `course_exists` returns only a boolean (never row content) via
    // SECURITY DEFINER, so this re-check can't leak anything a 403 response
    // doesn't already necessarily reveal.
    const [row] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.course_exists(${courseId}::uuid) AS exists`;
    if (!row?.exists) {
      throw new NotFoundError(`No course exists with id "${courseId}".`);
    }
    throw new ForbiddenError();
  }
  if (course.status !== "PUBLISHED") {
    throw new ForbiddenError();
  }

  const allowed = await canAccessCourse(userId, courseId);
  if (!allowed) {
    throw new ForbiddenError();
  }

  // A single query for modules with lessons nested via `include` — Prisma
  // batches the "many" side (one additional IN-query total), not once per
  // module (no N+1 across course -> modules -> lessons).
  const modules = await prisma.courseModule.findMany({
    where: { courseId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      lessons: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        // Phase 2I: the lesson viewer needs the attached media's MIME type
        // to distinguish DOCX (renderable) from legacy DOC (not) — both
        // share content_type "DOCUMENT". A plain scalar select, not a
        // second round trip: Prisma batches this into the same "many" side
        // query as `lessons` itself.
        include: { mediaAsset: { select: { mimeType: true } } },
      },
    },
  });

  const progress = await prisma.courseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  // Phase 4: PUBLISHED-only assessment summaries, embedded here rather than
  // a redundant "list assessments for course" route (see course-catalogue.ts's
  // doc comment). `my_attempts_used`/`my_best_result` come from this same
  // user's own attempts only — self-scoped, matching assessment_attempts' RLS.
  const assessments = await prisma.assessment.findMany({
    where: { courseId, status: "PUBLISHED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { attempts: { where: { userId }, select: { result: true } } },
  });

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail_media_id: course.thumbnailMediaId,
    category: course.category?.name ?? null,
    duration_minutes: course.durationMinutes,
    // Department visibility in the Trainer Portal UI unit — see
    // toCatalogueItem's identical field for the full rationale.
    departments: course.courseDepartments.map((cd) => cd.department),
    progress: toCourseProgressSummary(progress),
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      total_marks: assessment.totalMarks,
      passing_marks: assessment.passingMarks,
      duration_minutes: assessment.durationMinutes,
      due_date: assessment.dueDate ? assessment.dueDate.toISOString() : null,
      max_attempts: assessment.maxAttempts,
      my_attempts_used: assessment.attempts.length,
      my_best_result: computeBestAssessmentResult(assessment.attempts),
    })),
    modules: modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      image_media_id: module.imageMediaId,
      sort_order: module.sortOrder,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        content_type: lesson.contentType,
        media_asset_id: lesson.mediaAssetId,
        media_mime_type: lesson.mediaAsset?.mimeType ?? null,
        external_url: lesson.externalUrl,
        text_content: lesson.textContent,
        duration_seconds: lesson.durationSeconds,
        sort_order: lesson.sortOrder,
        is_required: lesson.isRequired,
        classification: lesson.classification,
      })),
    })),
  };
}
