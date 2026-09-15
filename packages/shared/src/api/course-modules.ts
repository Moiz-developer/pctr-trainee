import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * POST /api/v1/admin/courses/:courseId/modules (SYSTEM_PLAN.md §14.2,
 * permission `course.create` — same reasoning as the course-update
 * permission mapping in Unit 2.2's implementation report: no dedicated
 * `course.content.manage`-scoped module permission is required to exist by
 * name, so the existing authoring permission is reused rather than
 * inventing one). `sort_order` is required and client-supplied — the
 * schema has no default (§14.2: "sort_order integer NOT NULL"), and this
 * unit doesn't implement automatic reordering, so the client must state it
 * explicitly. `is_active` is not accepted on create — new modules always
 * start active (schema default), matching the Department/Course create
 * convention. `course_id`/`id`/timestamps are never client input — `course_id`
 * comes from the URL, not the body.
 */
export const createCourseModuleRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  sort_order: z.number().int(),
});
export type CreateCourseModuleRequest = z.infer<typeof createCourseModuleRequestSchema>;

/**
 * PATCH /api/v1/admin/courses/:courseId/modules/:id. Partial update;
 * `is_active` is the retire-content mechanism (SYSTEM_PLAN.md §17) — no
 * delete endpoint exists in this unit. Updating `sort_order` here changes
 * only this module's own value; no automatic renumbering of sibling
 * modules is performed (not requested, not invented).
 */
export const updateCourseModuleRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});
export type UpdateCourseModuleRequest = z.infer<typeof updateCourseModuleRequestSchema>;

/** Response shape for all course-module endpoints — mirrors §14.2's columns. */
export const courseModuleResponseSchema = z.object({
  id: idSchema,
  course_id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type CourseModuleResponse = z.infer<typeof courseModuleResponseSchema>;

/** GET /api/v1/admin/courses/:courseId/modules: { data, meta } (SYSTEM_PLAN.md §26). */
export const courseModuleListResponseSchema = apiPaginatedSchema(courseModuleResponseSchema);
export type CourseModuleListResponse = z.infer<typeof courseModuleListResponseSchema>;

/**
 * GET /api/v1/admin/courses/:courseId/modules query params. No `is_active`
 * filter — not requested by this unit, and listing intentionally returns
 * both active and inactive modules (an admin content-management view, not
 * the future user-facing catalogue). Page-size defaults mirror the
 * already-established convention (departments/courses list endpoints).
 */
export const listCourseModulesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListCourseModulesQuery = z.infer<typeof listCourseModulesQuerySchema>;
