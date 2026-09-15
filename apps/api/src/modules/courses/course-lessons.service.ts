import {
  checkLessonContentFields,
  type CreateCourseLessonRequest,
  type UpdateCourseLessonRequest,
  type ListCourseLessonsQuery,
  type CourseLessonResponse,
  type PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { CourseLesson } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  COURSE_MEDIA_BUCKET,
  MEDIA_BACKED_LESSON_CONTENT_TYPES,
} from "../media/media.constants.js";

function toResponse(lesson: CourseLesson): CourseLessonResponse {
  return {
    id: lesson.id,
    module_id: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    content_type: lesson.contentType,
    media_asset_id: lesson.mediaAssetId,
    external_url: lesson.externalUrl,
    text_content: lesson.textContent,
    duration_seconds: lesson.durationSeconds,
    sort_order: lesson.sortOrder,
    is_required: lesson.isRequired,
    classification: lesson.classification,
    is_active: lesson.isActive,
    created_at: lesson.createdAt.toISOString(),
    updated_at: lesson.updatedAt.toISOString(),
  };
}

/**
 * Verifies the full course -> module hierarchy (this unit's critical
 * requirement): the course must exist, and the module must actually
 * belong to it. A module from a different course is treated identically
 * to "doesn't exist" — 404 — so the mismatch never leaks which course a
 * module really belongs to.
 */
async function assertModuleInCourse(courseId: string, moduleId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
  const module = await prisma.courseModule.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true },
  });
  if (!module || module.courseId !== courseId) {
    throw new NotFoundError(`No module exists with id "${moduleId}" for course "${courseId}".`);
  }
}

/** Same treatment for the lesson leaf: a lesson from a different module is "doesn't exist". */
async function findOwnedLesson(moduleId: string, id: string): Promise<CourseLesson> {
  const lesson = await prisma.courseLesson.findUnique({ where: { id } });
  if (!lesson || lesson.moduleId !== moduleId) {
    throw new NotFoundError(`No lesson exists with id "${id}" for module "${moduleId}".`);
  }
  return lesson;
}

function throwContentFieldIssues(
  contentType: CourseLesson["contentType"],
  externalUrl: string | null | undefined,
  textContent: string | null | undefined,
): void {
  const issues = checkLessonContentFields(contentType, externalUrl, textContent);
  if (issues.length > 0) {
    const fields: Record<string, string[]> = {};
    for (const issue of issues) {
      (fields[issue.path] ??= []).push(issue.message);
    }
    throw new ValidationError(fields);
  }
}

/**
 * POST .../lessons (SYSTEM_PLAN.md §14.2, permission `course.create`).
 * Content-type/field consistency was already validated at the Zod layer
 * (createCourseLessonRequestSchema's superRefine) — this is a full,
 * self-contained payload, so no merge is needed here.
 */
export async function createCourseLesson(
  courseId: string,
  moduleId: string,
  input: CreateCourseLessonRequest,
): Promise<CourseLessonResponse> {
  await assertModuleInCourse(courseId, moduleId);

  const lesson = await prisma.courseLesson.create({
    data: {
      moduleId,
      title: input.title,
      description: input.description ?? null,
      contentType: input.content_type,
      externalUrl: input.external_url ?? null,
      textContent: input.text_content ?? null,
      durationSeconds: input.duration_seconds ?? null,
      sortOrder: input.sort_order,
      ...(input.is_required !== undefined ? { isRequired: input.is_required } : {}),
      classification: input.classification,
    },
  });
  return toResponse(lesson);
}

/** GET .../lessons/:id — verifies the full course -> module -> lesson chain. */
export async function getCourseLesson(
  courseId: string,
  moduleId: string,
  id: string,
): Promise<CourseLessonResponse> {
  await assertModuleInCourse(courseId, moduleId);
  const lesson = await findOwnedLesson(moduleId, id);
  return toResponse(lesson);
}

/**
 * GET .../lessons — paginated, ordered deterministically by `sort_order`
 * then `id`. Returns both active and inactive lessons — no filter was
 * requested for this admin content-management view.
 */
export async function listCourseLessons(
  courseId: string,
  moduleId: string,
  query: ListCourseLessonsQuery,
): Promise<{ items: CourseLessonResponse[]; meta: PaginationMeta }> {
  await assertModuleInCourse(courseId, moduleId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { moduleId };

  const [rows, totalItems] = await Promise.all([
    prisma.courseLesson.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseLesson.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * PATCH .../lessons/:id — partial update. Content-type/field consistency
 * is validated against the *merged* (existing + supplied) state, since a
 * partial payload may omit `content_type` and rely on the lesson's
 * current value — the request shape alone can't be validated for this
 * rule (see packages/shared/src/api/course-lessons.ts). `sort_order`
 * changes only this lesson's own value; siblings are never renumbered.
 */
export async function updateCourseLesson(
  courseId: string,
  moduleId: string,
  id: string,
  input: UpdateCourseLessonRequest,
): Promise<CourseLessonResponse> {
  await assertModuleInCourse(courseId, moduleId);
  const existing = await findOwnedLesson(moduleId, id);

  const effectiveContentType = input.content_type ?? existing.contentType;
  const effectiveExternalUrl =
    input.external_url !== undefined ? input.external_url : existing.externalUrl;
  const effectiveTextContent =
    input.text_content !== undefined ? input.text_content : existing.textContent;
  throwContentFieldIssues(effectiveContentType, effectiveExternalUrl, effectiveTextContent);

  // Now that Unit 2.8 makes `media_asset_id` assignable, block a content_type
  // change that would leave a TEXT/EXTERNAL_LINK lesson holding a media
  // reference (SYSTEM_PLAN.md §14.2: media_asset_id is "null when
  // EXTERNAL_LINK/TEXT"). This endpoint still doesn't accept media_asset_id;
  // the admin must detach via PUT .../lessons/:id/media first.
  if (
    (effectiveContentType === "TEXT" || effectiveContentType === "EXTERNAL_LINK") &&
    existing.mediaAssetId !== null
  ) {
    throw new ValidationError({
      content_type: [
        "Detach the media asset (PUT .../media with media_asset_id: null) before changing content_type to TEXT or EXTERNAL_LINK.",
      ],
    });
  }

  const lesson = await prisma.courseLesson.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.content_type !== undefined ? { contentType: input.content_type } : {}),
      ...(input.external_url !== undefined ? { externalUrl: input.external_url } : {}),
      ...(input.text_content !== undefined ? { textContent: input.text_content } : {}),
      ...(input.duration_seconds !== undefined ? { durationSeconds: input.duration_seconds } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
      ...(input.is_required !== undefined ? { isRequired: input.is_required } : {}),
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    },
  });
  return toResponse(lesson);
}

/**
 * PUT /api/v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/media
 * (Phase 2 Unit 2.8, permission `course.content.manage` — SYSTEM_PLAN.md
 * §16). Attach (`mediaAssetId`) or detach (`null`) a lesson's media
 * reference. Deliberately separate from `updateCourseLesson` (Unit 2.4) so
 * media management keeps its own permission and Unit 2.4's request contract
 * is unchanged. Validates the full course -> module -> lesson hierarchy,
 * that the lesson's content type may carry media (§14.2), and that the
 * referenced asset exists in the `course-media` bucket.
 */
export async function setCourseLessonMedia(
  courseId: string,
  moduleId: string,
  lessonId: string,
  mediaAssetId: string | null,
): Promise<CourseLessonResponse> {
  await assertModuleInCourse(courseId, moduleId);
  const lesson = await findOwnedLesson(moduleId, lessonId);

  if (mediaAssetId !== null) {
    if (!MEDIA_BACKED_LESSON_CONTENT_TYPES.has(lesson.contentType)) {
      throw new ValidationError({
        media_asset_id: [
          `A ${lesson.contentType} lesson cannot carry a media asset (SYSTEM_PLAN.md §14.2).`,
        ],
      });
    }
    const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    if (!media) {
      throw new ValidationError({
        media_asset_id: [`No media asset exists with id "${mediaAssetId}".`],
      });
    }
    if (media.bucket !== COURSE_MEDIA_BUCKET) {
      throw new ValidationError({ media_asset_id: ["That media asset is not course media."] });
    }
  }

  const updated = await prisma.courseLesson.update({
    where: { id: lessonId },
    data: { mediaAssetId },
  });
  return toResponse(updated);
}
