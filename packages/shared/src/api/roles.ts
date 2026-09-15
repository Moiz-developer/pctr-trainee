import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";

/**
 * Admin Role & Permission Management (SYSTEM_PLAN.md §5/§10). Reuses the
 * existing `roles`/`permissions`/`role_permissions` tables verbatim — no new
 * authorization architecture, no new tables. Permission CODES themselves
 * remain code-defined (apps/api/src/db/seed.ts's own `PERMISSIONS` array,
 * each one corresponding to an actual `requirePermission(code)` check
 * somewhere in this codebase — a permission that doesn't exist anywhere as
 * a real check would be meaningless to assign); only WHICH role holds which
 * permission becomes admin-manageable here.
 */

/** GET /api/v1/admin/permissions — the full, code-defined permission catalogue (read-only: assigning is dynamic, defining new codes is not). */
export const permissionResponseSchema = z.object({
  id: idSchema,
  code: z.string(),
  description: z.string().nullable(),
  created_at: isoDateStringSchema,
});
export type PermissionResponse = z.infer<typeof permissionResponseSchema>;

export const permissionListResponseSchema = apiSuccessSchema(z.array(permissionResponseSchema));
export type PermissionListResponse = z.infer<typeof permissionListResponseSchema>;

/**
 * `permission_ids` mirrors `AdminUserResponse.department_ids`'s exact
 * embedded-ids convention — lets the admin UI show/edit a role's current
 * permission set without a second round trip.
 */
export const roleResponseSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean(),
  permission_ids: z.array(idSchema),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type RoleResponse = z.infer<typeof roleResponseSchema>;

export const roleListResponseSchema = apiPaginatedSchema(roleResponseSchema);
export type RoleListResponse = z.infer<typeof roleListResponseSchema>;

export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;

/**
 * POST /api/v1/admin/roles. `code` is set once at creation and is immutable
 * afterward (see `updateRoleRequestSchema`). `is_system` is never
 * client-settable — every role created through this endpoint is a regular,
 * non-system role; `is_system` stays reserved for the seed-defined baseline
 * roles (ADMIN), matching this project's "never accept a server-controlled
 * field from client input" convention (created_by/uploaded_by/status-on-
 * create elsewhere).
 */
export const createRoleRequestSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
});
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

/**
 * PATCH /api/v1/admin/roles/:id — name/description only. `code`/`is_system`
 * are immutable via this endpoint: `code` because nothing else in this
 * codebase keys authorization off it, so there's no correctness reason to
 * churn it, and keeping it stable avoids any confusion for whoever reads
 * the roles list; `is_system` because it is never client-settable at all.
 */
export const updateRoleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
});
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

/**
 * PUT /api/v1/admin/roles/:id/permissions — replaces the role's full
 * permission set in one call, mirroring `setCourseDepartmentsRequestSchema`
 * (course-departments.ts) exactly: a checkbox-grid-style admin UI naturally
 * maps to "here is the complete desired set," not per-permission add/remove
 * calls.
 */
export const setRolePermissionsRequestSchema = z.object({
  permission_ids: z.array(idSchema),
});
export type SetRolePermissionsRequest = z.infer<typeof setRolePermissionsRequestSchema>;
