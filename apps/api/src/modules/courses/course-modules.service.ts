import type {
  CreateCourseModuleRequest,
  UpdateCourseModuleRequest,
  ListCourseModulesQuery,
  CourseModuleResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { CourseModule } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { COURSE_MEDIA_BUCKET } from "../media/media.constants.js";

function toResponse(module: CourseModule): CourseModuleResponse {
  return {
    id: module.id,
    course_id: module.courseId,
    title: module.title,
    description: module.description,
    image_media_id: module.imageMediaId,
    sort_order: module.sortOrder,
    is_active: module.isActive,
    created_at: module.createdAt.toISOString(),
    updated_at: module.updatedAt.toISOString(),
  };
}

async function assertCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new NotFoundError(`No course exists with id "${courseId}".`);
  }
}

/** A module image must be an uploaded `course-media` asset that is actually an image. */
async function assertModuleImageAsset(mediaAssetId: string): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media || media.bucket !== COURSE_MEDIA_BUCKET) {
    throw new ValidationError({
      image_media_id: [`No course media exists with id "${mediaAssetId}".`],
    });
  }
  if (!media.mimeType.startsWith("image/")) {
    throw new ValidationError({ image_media_id: ["The module image must be an image file."] });
  }
}

/**
 * Loads a module and verifies it actually belongs to `courseId` (this
 * unit's parent-child integrity requirement): a module from Course A
 * requested through Course B's URL is treated identically to "doesn't
 * exist" — 404, not a distinct 403 — so cross-course requests don't leak
 * which course a module actually belongs to.
 */
async function findOwnedModule(courseId: string, id: string): Promise<CourseModule> {
  const module = await prisma.courseModule.findUnique({ where: { id } });
  if (!module || module.courseId !== courseId) {
    throw new NotFoundError(`No module exists with id "${id}" for course "${courseId}".`);
  }
  return module;
}

/** POST /api/v1/admin/courses/:courseId/modules (SYSTEM_PLAN.md §14.2, permission `course.create`). */
export async function createCourseModule(
  courseId: string,
  input: CreateCourseModuleRequest,
): Promise<CourseModuleResponse> {
  await assertCourseExists(courseId);
  if (input.image_media_id) await assertModuleImageAsset(input.image_media_id);

  const module = await prisma.courseModule.create({
    data: {
      courseId,
      title: input.title,
      description: input.description ?? null,
      imageMediaId: input.image_media_id ?? null,
      sortOrder: input.sort_order,
    },
  });
  return toResponse(module);
}

/** GET /api/v1/admin/courses/:courseId/modules/:id. */
export async function getCourseModule(courseId: string, id: string): Promise<CourseModuleResponse> {
  await assertCourseExists(courseId);
  const module = await findOwnedModule(courseId, id);
  return toResponse(module);
}

/**
 * GET /api/v1/admin/courses/:courseId/modules — paginated, ordered
 * deterministically by `sort_order` then `id` (this unit's ordering
 * requirement). Returns both active and inactive modules — no filter was
 * requested for this admin content-management view.
 */
export async function listCourseModules(
  courseId: string,
  query: ListCourseModulesQuery,
): Promise<{ items: CourseModuleResponse[]; meta: PaginationMeta }> {
  await assertCourseExists(courseId);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { courseId };

  const [rows, totalItems] = await Promise.all([
    prisma.courseModule.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseModule.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * PATCH /api/v1/admin/courses/:courseId/modules/:id — partial update.
 * Updating `sort_order` changes only this module's own value; siblings are
 * never silently renumbered (not requested, not invented).
 */
export async function updateCourseModule(
  courseId: string,
  id: string,
  input: UpdateCourseModuleRequest,
): Promise<CourseModuleResponse> {
  await assertCourseExists(courseId);
  await findOwnedModule(courseId, id);
  if (input.image_media_id) await assertModuleImageAsset(input.image_media_id);

  const module = await prisma.courseModule.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.image_media_id !== undefined ? { imageMediaId: input.image_media_id } : {}),
      ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    },
  });
  return toResponse(module);
}
