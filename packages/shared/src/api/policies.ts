import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";
import { departmentResponseSchema } from "./departments.js";

/**
 * Policy & Procedures (SYSTEM_PLAN.md §14.8/§23/§26, Phase 5.2). `policies`
 * is the stable, versionless concept ("Attendance Policy"); `policy_versions`
 * is its immutable-once-superseded history. Covers the self-service half
 * (`GET /policies`, `GET /policies/:slug` — every authenticated user, the
 * ACTIVE version only) and the full admin side, gated by two deliberately
 * separate permissions: `policy.manage` (create/update policies and
 * versions, upload/replace documents) and the pre-existing
 * `policy.version.activate` (activate a version — the one permission the
 * plan itself already names, §5).
 *
 * `effective_date` is a plain `YYYY-MM-DD` string (a DATE column, not a
 * timestamp) — mirrors `training-hour-requirements.ts`'s identical
 * `effective_from` convention exactly, same regex validation.
 */

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD).");

// ---------------------------------------------------------------------------
// Policy Versions
// ---------------------------------------------------------------------------

/**
 * The full admin-facing version shape — includes `is_active`/`is_archived`
 * and `uploaded_by`, none of which the trainee-facing summary needs (a
 * trainee only ever sees the one active version, so "is this active" is
 * always implicitly true there). Used for the admin detail page's full
 * version-history table (§23: "admins can browse full history including
 * archived versions").
 */
export const policyVersionResponseSchema = z.object({
  id: idSchema,
  policy_id: idSchema,
  version_label: z.string(),
  media_asset_id: idSchema.nullable(),
  content: z.string().nullable(),
  effective_date: z.string(),
  is_active: z.boolean(),
  is_archived: z.boolean(),
  uploaded_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type PolicyVersionResponse = z.infer<typeof policyVersionResponseSchema>;

/**
 * The trainee-facing summary embedded in a policy's list/detail response —
 * always the currently active version (there is at most one, enforced at
 * the database level, §14.8). `updated_at` doubles as "last updated" for
 * the trainee listing's own required column: since activating a version IS
 * an UPDATE to that version's row, this timestamp correctly reflects "when
 * this version last became/stayed current," not a stale parent-row value.
 *
 * `media_mime_type` (download restriction unit): the attached document's
 * MIME type, joined from `media_assets.mime_type` at query time — mirrors
 * `CourseDetailLesson.media_mime_type`'s identical convention exactly
 * (course-catalogue.ts / user-courses.service.ts). Lets the trainee UI pick
 * the correct in-app viewer (PdfLessonViewer/DocumentLessonViewer) instead
 * of always opening a signed URL directly; `null` when there's no attached
 * document (inline `content` only).
 */
export const activePolicyVersionSchema = z.object({
  id: idSchema,
  version_label: z.string(),
  media_asset_id: idSchema.nullable(),
  media_mime_type: z.string().nullable(),
  content: z.string().nullable(),
  effective_date: z.string(),
  updated_at: isoDateStringSchema,
});
export type ActivePolicyVersion = z.infer<typeof activePolicyVersionSchema>;

/**
 * POST /api/v1/admin/policies/:policyId/versions (permission `policy.manage`).
 * At least one of `media_asset_id`/`content` is required (§14.8 lists both
 * as individually nullable, but a version with neither carries no actual
 * content). `media_asset_id`, when supplied, must reference a
 * `policy-documents`-bucket asset (validated server-side, see
 * admin-policies.service.ts) obtained beforehand via the existing
 * `POST /media/upload-url` + `POST /media/confirm` flow, purpose
 * `policy-documents`. Never starts active — activation is always the
 * separate, explicit `POST .../activate` call.
 */
export const createPolicyVersionRequestSchema = z
  .object({
    version_label: z.string().min(1),
    effective_date: dateOnlySchema,
    media_asset_id: idSchema.optional(),
    content: z.string().min(1).optional(),
  })
  .refine((data) => data.media_asset_id !== undefined || data.content !== undefined, {
    message: "Provide a document (media_asset_id) or inline content.",
    path: ["media_asset_id"],
  });
export type CreatePolicyVersionRequest = z.infer<typeof createPolicyVersionRequestSchema>;

/**
 * PATCH /api/v1/admin/policies/:policyId/versions/:versionId — partial
 * update (version_label/effective_date/content), and "upload/replace
 * documents" (re-supplying `media_asset_id`, revalidated the same way as
 * creation). Never accepts `is_active`/`is_archived` here — those change
 * only via the dedicated `POST .../activate` endpoint, so an activation is
 * always the one auditable, transactional action §14.8 describes, never a
 * side effect of an ordinary field edit.
 */
export const updatePolicyVersionRequestSchema = z.object({
  version_label: z.string().min(1).optional(),
  effective_date: dateOnlySchema.optional(),
  media_asset_id: idSchema.optional(),
  content: z.string().min(1).nullable().optional(),
});
export type UpdatePolicyVersionRequest = z.infer<typeof updatePolicyVersionRequestSchema>;

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/** Trainee-facing: the policy plus its currently active version. Only ever returned for policies that HAVE one. */
export const policyResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  active_version: activePolicyVersionSchema,
});
export type PolicyResponse = z.infer<typeof policyResponseSchema>;

export const policyListResponseSchema = apiPaginatedSchema(policyResponseSchema);
export type PolicyListResponse = z.infer<typeof policyListResponseSchema>;

export const policyDetailResponseSchema = apiSuccessSchema(policyResponseSchema);
export type PolicyDetailResponse = z.infer<typeof policyDetailResponseSchema>;

export const listPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListPoliciesQuery = z.infer<typeof listPoliciesQuerySchema>;

/**
 * Admin-facing: the policy plus its active version summary (nullable — a
 * brand-new policy has no active version until one is explicitly
 * activated) for the admin list table's "Active Version"/"Effective Date"
 * columns.
 */
export const adminPolicyResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  active_version: activePolicyVersionSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type AdminPolicyResponse = z.infer<typeof adminPolicyResponseSchema>;

export const adminPolicyListResponseSchema = apiPaginatedSchema(adminPolicyResponseSchema);
export type AdminPolicyListResponse = z.infer<typeof adminPolicyListResponseSchema>;

/** GET /api/v1/admin/policies/:id — the policy plus EVERY version (active, archived, draft), oldest first. */
export const adminPolicyDetailSchema = adminPolicyResponseSchema.extend({
  versions: z.array(policyVersionResponseSchema),
});
export type AdminPolicyDetail = z.infer<typeof adminPolicyDetailSchema>;

export const adminPolicyDetailResponseSchema = apiSuccessSchema(adminPolicyDetailSchema);
export type AdminPolicyDetailResponse = z.infer<typeof adminPolicyDetailResponseSchema>;

export const listAdminPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAdminPoliciesQuery = z.infer<typeof listAdminPoliciesQuerySchema>;

/** POST /api/v1/admin/policies (permission `policy.manage`). */
export const createPolicyRequestSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
});
export type CreatePolicyRequest = z.infer<typeof createPolicyRequestSchema>;

/** PATCH /api/v1/admin/policies/:id — partial update of the policy's own metadata (not its versions). */
export const updatePolicyRequestSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  category: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
});
export type UpdatePolicyRequest = z.infer<typeof updatePolicyRequestSchema>;

// ---------------------------------------------------------------------------
// Policy <-> Department targeting (consistent granular access control unit,
// §7) — mirrors packages/shared/src/api/resources.ts's resource-department
// schemas field-for-field (same whole-set-replace shape, same
// department.manage permission).
// ---------------------------------------------------------------------------

export const setPolicyDepartmentsRequestSchema = z.object({
  department_ids: z.array(idSchema),
});
export type SetPolicyDepartmentsRequest = z.infer<typeof setPolicyDepartmentsRequestSchema>;

export const policyDepartmentsResponseSchema = apiSuccessSchema(z.array(departmentResponseSchema));
export type PolicyDepartmentsResponse = z.infer<typeof policyDepartmentsResponseSchema>;
