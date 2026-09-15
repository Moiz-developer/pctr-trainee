import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * Course Categories (Admin Navigation + Dynamic Course Categories unit).
 * Mirrors packages/shared/src/api/departments.ts field-for-field — the same
 * admin-managed-lookup-table shape (name/slug/description/is_active), same
 * "no slugification algorithm invented, slug is client-supplied" reasoning.
 */

/**
 * POST /api/v1/admin/course-categories (permission `course.create` — see
 * course-categories.routes.ts). `department_id` (Department -> Category ->
 * Training Content hierarchy unit) is optional/nullable — omit or pass
 * `null` for a global category (visible/usable regardless of department),
 * matching every other `*_department_id`-style field's "null = global"
 * convention in this codebase.
 */
export const createCourseCategoryRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  department_id: idSchema.nullable().optional(),
});
export type CreateCourseCategoryRequest = z.infer<typeof createCourseCategoryRequestSchema>;

/**
 * PATCH /api/v1/admin/course-categories/:id. `is_active` is the
 * activate/deactivate mechanism this unit's task requires — same toggle
 * pattern as `UpdateDepartmentRequest`, no separate archive endpoint.
 */
export const updateCourseCategoryRequestSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  department_id: idSchema.nullable().optional(),
});
export type UpdateCourseCategoryRequest = z.infer<typeof updateCourseCategoryRequestSchema>;

/** Response shape for all course-category endpoints. */
export const courseCategoryResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  department_id: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type CourseCategoryResponse = z.infer<typeof courseCategoryResponseSchema>;

/** GET /api/v1/admin/course-categories: { data: CourseCategoryResponse[], meta: PaginationMeta }. */
export const courseCategoryListResponseSchema = apiPaginatedSchema(courseCategoryResponseSchema);
export type CourseCategoryListResponse = z.infer<typeof courseCategoryListResponseSchema>;

/** GET /api/v1/admin/course-categories query params — mirrors the department list endpoint's convention. */
export const listCourseCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
export type ListCourseCategoriesQuery = z.infer<typeof listCourseCategoriesQuerySchema>;

/**
 * The minimal category reference embedded in Course responses (admin
 * create/update/list/detail) — mirrors the existing `role: {id, code, name}`
 * shape already used by AdminUserResponse (users.service.ts's `toResponse`)
 * for the exact same reason: the id is needed to pre-select an edit form's
 * dropdown, the name is needed to render it, and nothing else is needed.
 */
export const courseCategoryRefSchema = z.object({
  id: idSchema,
  name: z.string(),
});
export type CourseCategoryRef = z.infer<typeof courseCategoryRefSchema>;
