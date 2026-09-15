import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * POST /api/v1/admin/departments (SYSTEM_PLAN.md §26, permission
 * `department.manage`). Fields match §14.1's `departments` columns exactly
 * (`name`, `slug`, `description`). `slug` is client-supplied, not
 * server-generated — SYSTEM_PLAN.md defines no slugification algorithm
 * anywhere and no prior unit in this repo establishes one, so inventing one
 * (accent-stripping, collision suffixing, etc.) would be exactly the kind of
 * unrequested business rule this unit's task forbids; see this unit's
 * implementation report. `is_active` is not accepted on create — new
 * departments always start active (schema default, §14.1), matching the
 * general pattern that state changes go through the update endpoint.
 */
export const createDepartmentRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
});
export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;

/**
 * PATCH /api/v1/admin/departments/:id. Partial update, mirrors the existing
 * PATCH /admin/users/:id convention exactly (SYSTEM_PLAN.md §26 "includes
 * status changes" — here, `is_active` is the department's status
 * equivalent, toggleable in both directions since the plan defines no
 * restriction on reactivation). `description` accepts explicit `null` to
 * clear it; every other field has no "cleared" state (all NOT NULL, §14.1),
 * so omission is the only way to leave them unchanged.
 */
export const updateDepartmentRequestSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
});
export type UpdateDepartmentRequest = z.infer<typeof updateDepartmentRequestSchema>;

/**
 * Department visibility in the Trainer Portal UI unit: the minimal
 * department reference embedded in trainee-facing course/resource
 * responses — mirrors `courseCategoryRefSchema`/`resourceCategoryRefSchema`'s
 * identical `{id, name}`-only convention (course-categories.ts/resources.ts)
 * rather than the full admin `DepartmentResponse` shape, which carries
 * fields (`slug`, `is_active`, timestamps) no trainee-facing card needs.
 */
export const departmentRefSchema = z.object({
  id: idSchema,
  name: z.string(),
});
export type DepartmentRef = z.infer<typeof departmentRefSchema>;

/** Response shape for all department endpoints — mirrors §14.1's columns. */
export const departmentResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;

/** GET /api/v1/admin/departments: { data: DepartmentResponse[], meta: PaginationMeta }. */
export const departmentListResponseSchema = apiPaginatedSchema(departmentResponseSchema);
export type DepartmentListResponse = z.infer<typeof departmentListResponseSchema>;

/**
 * GET /api/v1/admin/departments query params. SYSTEM_PLAN.md §26 requires
 * pagination and basic `is_active` filtering on admin list endpoints but
 * does not specify default/max page size anywhere, and no prior unit
 * establishes a convention (Admin User CRUD has no list endpoint) — 20/100
 * are applied here as a conventional, easily-revised default, not a
 * plan-derived requirement; see this unit's implementation report.
 */
export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;

/**
 * POST /api/v1/admin/users/:id/departments — assigns a department to a
 * user. SYSTEM_PLAN.md §40 lists "user-department assignment" as a required
 * Phase 1 deliverable, and §14.1 defines the `user_departments` row shape,
 * but the plan specifies no route, permission, or request/response shape
 * for it anywhere — this contract (route placement under the user
 * resource, `department.manage` permission, reuse of `AdminUserResponse` as
 * the response) is derived by documented structural analogy, not invented
 * freely; see this unit's implementation report. `assigned_by`/`assigned_at`
 * are never client-supplied — server-derived from the authenticated
 * identity / `now()`, matching the existing anti-impersonation pattern
 * already used for `created_by`-style fields (e.g. admin-user creation's
 * `createdBy`).
 */
export const assignUserDepartmentRequestSchema = z.object({
  department_id: idSchema,
  is_primary: z.boolean().optional(),
});
export type AssignUserDepartmentRequest = z.infer<typeof assignUserDepartmentRequestSchema>;
