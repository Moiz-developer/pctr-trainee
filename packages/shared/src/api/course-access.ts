import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * POST /api/v1/admin/courses/:courseId/access (SYSTEM_PLAN.md §26, permission
 * `course.access.manage` — already seeded, described as exactly "Grant/revoke
 * explicit user-level course access"; no new permission created). `user_id`
 * is validated as a well-formed UUID — unlike most id fields elsewhere in
 * this codebase (`idSchema` is a plain `z.string()`), this endpoint's own
 * unit spec explicitly requires a 422 on a malformed UUID, so strict format
 * validation is applied here specifically; see this unit's implementation
 * report. `granted_by`/timestamps/`revoked_*`/status fields are never
 * client input.
 */
export const grantCourseAccessRequestSchema = z.object({
  user_id: z.uuid(),
});
export type GrantCourseAccessRequest = z.infer<typeof grantCourseAccessRequestSchema>;

/**
 * POST /api/v1/admin/users/:id/course-access (Training Access assignment
 * inside User Management unit) — the user-centric mirror of
 * `grantCourseAccessRequestSchema` above (`course_id` instead of `user_id`,
 * since the user is already fixed by the URL here). Same
 * `course.access.manage` permission, same underlying `grantCourseAccess`
 * service function (courses/course-access.service.ts, called with the
 * user id taken from the URL) — no new authorization architecture, no new
 * table. Uses the loose `idSchema` (matching users.routes.ts's own
 * convention) rather than course-access.routes.ts's one-off strict
 * `z.uuid()`.
 */
export const grantUserCourseAccessRequestSchema = z.object({
  course_id: idSchema,
});
export type GrantUserCourseAccessRequest = z.infer<typeof grantUserCourseAccessRequestSchema>;

/**
 * Response shape — mirrors §14.2's `course_access` columns exactly (`id`,
 * `course_id`, `user_id`, `granted_by`, `granted_at`, `revoked_by`,
 * `revoked_at`), plus a derived `is_active` convenience (`revoked_at IS
 * NULL`) — the plan stores no separate status column, since active/revoked
 * state is fully determined by `revoked_at`.
 */
export const courseAccessResponseSchema = z.object({
  id: idSchema,
  course_id: idSchema,
  user_id: idSchema,
  granted_by: idSchema.nullable(),
  granted_at: isoDateStringSchema,
  revoked_by: idSchema.nullable(),
  revoked_at: isoDateStringSchema.nullable(),
  is_active: z.boolean(),
});
export type CourseAccessResponse = z.infer<typeof courseAccessResponseSchema>;

/** GET /api/v1/admin/courses/:courseId/access: { data, meta } (SYSTEM_PLAN.md §26). */
export const courseAccessListResponseSchema = apiPaginatedSchema(courseAccessResponseSchema);
export type CourseAccessListResponse = z.infer<typeof courseAccessListResponseSchema>;

/** Page-size defaults mirror the already-established convention (courses/modules/lessons lists). */
export const listCourseAccessQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListCourseAccessQuery = z.infer<typeof listCourseAccessQuerySchema>;
