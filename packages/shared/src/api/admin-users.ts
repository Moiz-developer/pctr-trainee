import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * POST /api/v1/admin/users (SYSTEM_PLAN.md §9): field names and casing are
 * taken verbatim from the plan's own text — "Admin submits
 * { full_name, email, phone, department_ids, role_id, employee_id }".
 * `phone` is optional (profiles.phone is nullable, §14.1); every other field
 * is required, matching §9/§14.1 exactly.
 */
export const createUserRequestSchema = z.object({
  full_name: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1).optional(),
  department_ids: z.array(idSchema),
  role_id: idSchema,
  employee_id: z.string().min(1),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

/**
 * PATCH /api/v1/admin/users/:id (SYSTEM_PLAN.md §26: "includes status
 * changes"). All fields optional (partial update — omitted means
 * unchanged). `phone` accepts explicit `null` to clear it (profiles.phone is
 * nullable); every other field has no valid "cleared" state (all NOT NULL in
 * §14.1), so omission is the only way to leave them unchanged.
 *
 * Deliberately excludes department reassignment — see this unit's
 * implementation report for why that's left to a future dedicated endpoint.
 */
export const updateUserRequestSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.email().optional(),
  phone: z.string().min(1).nullable().optional(),
  role_id: idSchema.optional(),
  employee_id: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

/** Response shape for both admin-user endpoints. */
export const adminUserResponseSchema = z.object({
  id: idSchema,
  employee_id: z.string(),
  full_name: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  role: z.object({ id: idSchema, code: z.string(), name: z.string() }),
  department_ids: z.array(idSchema),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;

/** GET /api/v1/admin/users: { data: AdminUserResponse[], meta: PaginationMeta }. */
export const adminUserListResponseSchema = apiPaginatedSchema(adminUserResponseSchema);
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

/**
 * GET /api/v1/admin/users query params (new — this unit: the Admin Course
 * Access UI needs a way to look up a user to grant explicit access to,
 * dynamically, rather than requiring a raw id). `search` matches against
 * `full_name`/`employee_id`/`email` (case-insensitive); optional and loose,
 * matching how `status`/`is_active` filters work on the existing
 * courses/departments list endpoints. Page-size defaults mirror the
 * already-established convention.
 *
 * `status` (Admin Dashboard real data unit): an optional exact-match filter
 * on the same `status` column already returned by every row — mirrors
 * `listCoursesQuerySchema.status`/`listAdminAnnouncementsQuerySchema.status`'s
 * identical "optional status filter on an existing list endpoint" shape.
 * Added so the real "Active Trainees" count can be read straight off
 * `meta.totalItems` (`GET /admin/users?status=ACTIVE&pageSize=1`) instead of
 * paging through every user client-side.
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().min(1).max(255).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
