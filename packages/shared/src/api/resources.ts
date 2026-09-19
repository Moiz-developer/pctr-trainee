import { z } from "zod";
import { httpsUrlSchema, idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { departmentResponseSchema, departmentRefSchema } from "./departments.js";

/**
 * Resource Library (SYSTEM_PLAN.md §14.5/§20/§26, Phase 5.1). Mirrors the
 * existing course-categories + course-departments + query-attachment-media
 * patterns field-for-field — no new architecture. Covers the self-service
 * half (`GET /resources`, `GET /resources/:id`, `GET /resources/categories`
 * — every authenticated user, PUBLISHED + department-visible only) and the
 * full admin side, permission `resource.manage`: category management
 * (`/admin/resource-categories`), resource CRUD (`/admin/resources`), and
 * department targeting (`/admin/resources/:id/departments`, permission
 * `department.manage` — matches course-departments' own precedent of
 * gating "which departments can see this X" by the department-authority
 * permission).
 */

// ---------------------------------------------------------------------------
// Resource Categories — mirrors packages/shared/src/api/course-categories.ts
// field-for-field (same admin-managed-lookup-table shape).
// ---------------------------------------------------------------------------

/** `department_id` (Department -> Category -> Training Content hierarchy unit): null/omitted = a global category. */
export const createResourceCategoryRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  department_id: idSchema.nullable().optional(),
});
export type CreateResourceCategoryRequest = z.infer<typeof createResourceCategoryRequestSchema>;

export const updateResourceCategoryRequestSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  department_id: idSchema.nullable().optional(),
});
export type UpdateResourceCategoryRequest = z.infer<typeof updateResourceCategoryRequestSchema>;

export const resourceCategoryResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  department_id: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type ResourceCategoryResponse = z.infer<typeof resourceCategoryResponseSchema>;

export const resourceCategoryListResponseSchema = apiPaginatedSchema(
  resourceCategoryResponseSchema,
);
export type ResourceCategoryListResponse = z.infer<typeof resourceCategoryListResponseSchema>;

/**
 * GET /api/v1/resources/categories (trainee-facing) — a plain, non-paginated
 * `{data: [...]}` list, unlike the admin CRUD list above: this is a small,
 * bounded lookup-table read for a filter dropdown, not a browse list.
 * Mirrors `queryCategoryListResponseSchema`'s identical shape/reasoning
 * (packages/shared/src/api/queries.ts).
 */
export const visibleResourceCategoryListResponseSchema = apiSuccessSchema(
  z.array(resourceCategoryResponseSchema),
);
export type VisibleResourceCategoryListResponse = z.infer<
  typeof visibleResourceCategoryListResponseSchema
>;

export const listResourceCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
export type ListResourceCategoriesQuery = z.infer<typeof listResourceCategoriesQuerySchema>;

/** The minimal category reference embedded in Resource responses — mirrors `courseCategoryRefSchema`. */
export const resourceCategoryRefSchema = z.object({
  id: idSchema,
  name: z.string(),
});
export type ResourceCategoryRef = z.infer<typeof resourceCategoryRefSchema>;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const resourceStatusSchema = z.enum(["PUBLISHED", "ARCHIVED"]);
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;

/**
 * Response shape shared by both the trainee-facing (`GET /resources`,
 * `GET /resources/:id`) and admin (`GET /admin/resources`,
 * `GET /admin/resources/:id`) endpoints — unlike Queries, a resource has no
 * per-caller "owner" concept beyond `uploaded_by`, so one shape serves both;
 * a trainee only ever receives `status: "PUBLISHED"` rows in practice
 * (server-enforced, §14.5/§20). `media_asset_id` is a bare reference, never
 * resolved to a URL here — the client requests a signed download URL via
 * the existing `GET /media/:id/access-url` flow (§16), same as every other
 * media reference in this codebase.
 *
 * Useful Links unit: exactly one of `media_asset_id`/`external_url` is
 * non-null (DB-enforced, `resources_media_or_url_check`) — a file-backed
 * resource has `external_url: null`, a URL-backed one has
 * `media_asset_id: null` and `file_type: "LINK"` (a fixed sentinel, not a
 * MIME type — see resources.service.ts/admin-resources.service.ts).
 * `external_url` is returned as-is (no signed-URL indirection needed — it's
 * already a public link the trainee opens directly).
 */
export const resourceResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  category: resourceCategoryRefSchema,
  media_asset_id: idSchema.nullable(),
  external_url: httpsUrlSchema.nullable(),
  file_type: z.string(),
  uploaded_by: idSchema.nullable(),
  status: resourceStatusSchema,
  // Department visibility in the Trainer Portal UI unit: the department(s)
  // this resource is assigned to (from `resource_departments`, already the
  // authoritative access-control source `effectiveResourceVisibilityFilter`
  // reads — a read-only display of that same existing data, not a new
  // access-control input). Empty array = globally visible, the same "empty
  // mapping = global" convention `resource_departments` already uses.
  departments: z.array(departmentRefSchema),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type ResourceResponse = z.infer<typeof resourceResponseSchema>;

export const resourceListResponseSchema = apiPaginatedSchema(resourceResponseSchema);
export type ResourceListResponse = z.infer<typeof resourceListResponseSchema>;

export const resourceDetailResponseSchema = apiSuccessSchema(resourceResponseSchema);
export type ResourceDetailResponse = z.infer<typeof resourceDetailResponseSchema>;

/** GET /api/v1/resources — trainee-facing, PUBLISHED + department-visible only, filterable by category. */
export const listResourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  category_id: idSchema.optional(),
});
export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;

/** GET /api/v1/admin/resources — every resource, filterable by status and/or category. */
export const listAdminResourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: resourceStatusSchema.optional(),
  category_id: idSchema.optional(),
});
export type ListAdminResourcesQuery = z.infer<typeof listAdminResourcesQuerySchema>;

/**
 * POST /api/v1/admin/resources (permission `resource.manage`). `category_id`
 * is always required; exactly one of `media_asset_id`/`external_url` is
 * required (Useful Links unit — a resource is either file-backed or
 * URL-backed, never both, never neither). `media_asset_id` must reference a
 * `resource-files`-bucket asset (validated server-side, see
 * resources.service.ts) obtained beforehand via the existing
 * `POST /media/upload-url` + `POST /media/confirm` flow, purpose
 * `resource-files`. `external_url` reuses the same `z.url()` validator
 * course-lessons.ts's EXTERNAL_LINK content type already uses. `file_type`/
 * `uploaded_by` are never client-supplied — server-derived (from the
 * attached media asset, or the fixed "LINK" sentinel, and the authenticated
 * identity, respectively).
 */
export const createResourceRequestSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).nullable().optional(),
    category_id: idSchema,
    media_asset_id: idSchema.optional(),
    external_url: httpsUrlSchema.optional(),
    status: resourceStatusSchema.optional(),
  })
  .refine((data) => (data.media_asset_id !== undefined) !== (data.external_url !== undefined), {
    message: "Provide exactly one of media_asset_id or external_url.",
    path: ["media_asset_id"],
  });
export type CreateResourceRequest = z.infer<typeof createResourceRequestSchema>;

/**
 * PATCH /api/v1/admin/resources/:id — partial update. `status` toggling
 * (PUBLISHED <-> ARCHIVED) doubles as this feature's "delete" (§13's
 * project-wide soft-delete/archive-over-hard-delete rule — mirrors
 * `updateCourseCategory`'s bidirectional `is_active` toggle more closely
 * than courses' one-way `archiveCourse`, since §14.5 defines only two
 * resource states with no draft workflow). Re-supplying `media_asset_id`
 * replaces the attached file and recomputes `file_type` to match;
 * re-supplying `external_url` switches to (or updates) the link. Passing
 * either as `null` clears it. This schema only rejects a payload that sets
 * BOTH in the same request — the full "exactly one, after merge" invariant
 * is re-validated in the service layer against the existing row's state
 * (same established pattern as `updateAssessmentRequestSchema`'s
 * passing_marks<=total_marks re-check).
 */
export const updateResourceRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).nullable().optional(),
    category_id: idSchema.optional(),
    media_asset_id: idSchema.nullable().optional(),
    external_url: httpsUrlSchema.nullable().optional(),
    status: resourceStatusSchema.optional(),
  })
  .refine((data) => !(data.media_asset_id != null && data.external_url != null), {
    message: "Provide either media_asset_id or external_url, not both.",
    path: ["media_asset_id"],
  });
export type UpdateResourceRequest = z.infer<typeof updateResourceRequestSchema>;

// ---------------------------------------------------------------------------
// Resource <-> Department assignment — mirrors
// packages/shared/src/api/course-departments.ts field-for-field (same
// whole-set-replace shape, same department.manage permission).
// ---------------------------------------------------------------------------

export const setResourceDepartmentsRequestSchema = z.object({
  department_ids: z.array(idSchema),
});
export type SetResourceDepartmentsRequest = z.infer<typeof setResourceDepartmentsRequestSchema>;

export const resourceDepartmentsResponseSchema = apiSuccessSchema(
  z.array(departmentResponseSchema),
);
export type ResourceDepartmentsResponse = z.infer<typeof resourceDepartmentsResponseSchema>;
