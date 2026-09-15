import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";

/**
 * Query/Support ticket API (SYSTEM_PLAN.md §14.7/§22/§26). Covers the
 * self-service half — `POST /queries` (create own ticket, optionally with
 * one attachment — Phase 6.2), `GET /queries` (list own tickets), and
 * `GET /queries/:id` + `POST /queries/:id/messages` (own thread — Phase
 * 6.4) — plus the full admin side, permission `query.manage`: the queue
 * (`GET /admin/queries` — Phase 6.6) and per-ticket management (`GET
 * /admin/queries/:id`, `POST /admin/queries/:id/messages`, `PATCH
 * /admin/queries/:id` for status/assignment — Phase 6.7). `status` is
 * never client-settable on the trainee-facing create/list/detail
 * endpoints — only `updateAdminQueryRequestSchema` (admin-only) accepts it.
 *
 * Attachments reuse the existing generic media upload flow
 * (`POST /media/upload-url` / `POST /media/confirm`, purpose
 * `query-attachments`) rather than a bespoke upload endpoint — the client
 * uploads first and passes the resulting `media_asset_id` here. Per
 * §14.7's own schema, an attachment belongs to a `query_messages` row, not
 * directly to the `queries` row, so creating a query with an attachment
 * transparently creates that ticket's own opening `query_messages` row
 * (message text = the ticket description) to carry it — see
 * queries.service.ts.
 */

export const queryPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH"]);
export type QueryPriority = z.infer<typeof queryPrioritySchema>;

export const queryStatusSchema = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "RESPONDED",
  "RESOLVED",
  "CLOSED",
]);
export type QueryStatus = z.infer<typeof queryStatusSchema>;

/**
 * Response shape for both list and detail — mirrors §14.7's `queries`
 * columns; `course_title` is a denormalized convenience join (like
 * training-hour-requirements.ts's `department_name`). `has_attachment`
 * (Phase 6.2) reflects whether the ticket's opening message carries a
 * `query_attachments` row — derived, not a stored column.
 *
 * Query Category dropdown unit: `category` (free text) is the LEGACY field,
 * kept as-is for backward compatibility with tickets created before this
 * unit — never written by new tickets. `category_id`/`category_name` are
 * the new controlled-vocabulary fields (`category_name` is a denormalized
 * join onto `query_categories.name`, the same `course_id`/`course_title`
 * convenience-join shape already used two fields below). A ticket has at
 * most one of `category`/`category_id` meaningfully set in practice, but
 * both are always present on the response so older tickets keep displaying
 * their original free-text value.
 */
export const queryResponseSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  subject: z.string(),
  category: z.string().nullable(),
  category_id: idSchema.nullable(),
  category_name: z.string().nullable(),
  description: z.string(),
  course_id: idSchema.nullable(),
  course_title: z.string().nullable(),
  priority: queryPrioritySchema,
  status: queryStatusSchema,
  assigned_to: idSchema.nullable(),
  has_attachment: z.boolean(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type QueryResponse = z.infer<typeof queryResponseSchema>;

export const queryListResponseSchema = apiPaginatedSchema(queryResponseSchema);
export type QueryListResponse = z.infer<typeof queryListResponseSchema>;

/** GET /api/v1/queries query params — page-size defaults mirror the already-established convention. */
export const listQueriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListQueriesQuery = z.infer<typeof listQueriesQuerySchema>;

/**
 * Phase 6.4 — Trainer Query Conversation (SYSTEM_PLAN.md §14.7/§22: "one
 * `queries` row ... containing many `query_messages` ... each optionally
 * carrying `query_attachments`"). One attachment reference per message —
 * `id` is the underlying `media_asset_id`, resolved to a viewable URL only
 * via the existing `GET /media/:id/access-url` flow (never a direct link;
 * §16). `sender_name`/`sender_id` are nullable because `query_messages.sender_id`
 * is `ON DELETE SET NULL` (§14.7) — a departed user's past messages are kept.
 */
export const queryMessageAttachmentSchema = z.object({
  id: idSchema,
  original_filename: z.string(),
  mime_type: z.string(),
});
export type QueryMessageAttachment = z.infer<typeof queryMessageAttachmentSchema>;

export const queryMessageResponseSchema = z.object({
  id: idSchema,
  sender_id: idSchema.nullable(),
  sender_name: z.string().nullable(),
  message: z.string(),
  created_at: isoDateStringSchema,
  attachments: z.array(queryMessageAttachmentSchema),
});
export type QueryMessageResponse = z.infer<typeof queryMessageResponseSchema>;

/**
 * GET /api/v1/queries/:id — the full ticket plus its conversation thread,
 * oldest message first (matches query_messages' own `(query_id, created_at)`
 * index / §14.7's "conversation thread" framing). Self-only: 403 if the
 * query exists but isn't the caller's own, 404 if it genuinely doesn't
 * exist (SYSTEM_PLAN.md §26/§31 — see queries.service.ts).
 */
export const queryDetailSchema = queryResponseSchema.extend({
  messages: z.array(queryMessageResponseSchema),
});
export type QueryDetail = z.infer<typeof queryDetailSchema>;

export const queryDetailResponseSchema = apiSuccessSchema(queryDetailSchema);
export type QueryDetailResponse = z.infer<typeof queryDetailResponseSchema>;

/**
 * POST /api/v1/queries/:id/messages — a follow-up message from the ticket
 * owner. `sender_id` is never client-supplied (route-derived, same
 * anti-impersonation convention as `createQueryRequestSchema`).
 * `media_asset_id`, if supplied, follows the exact same upload-then-attach
 * flow and server-side ownership/bucket validation as ticket creation
 * (Phase 6.2) — see queries.service.ts.
 */
export const createQueryMessageRequestSchema = z.object({
  message: z.string().min(1),
  media_asset_id: idSchema.optional(),
});
export type CreateQueryMessageRequest = z.infer<typeof createQueryMessageRequestSchema>;

export const queryMessageDetailResponseSchema = apiSuccessSchema(queryMessageResponseSchema);
export type QueryMessageDetailResponse = z.infer<typeof queryMessageDetailResponseSchema>;

/**
 * POST /api/v1/queries. `user_id` is never client-supplied — always the
 * authenticated caller (route-derived), matching this project's established
 * anti-impersonation convention. `priority` defaults to `NORMAL` (the DB
 * default) when omitted; `course_id`, if supplied, must reference an
 * existing course (validated server-side — see queries.service.ts).
 * `media_asset_id` (Phase 6.2), if supplied, must reference a
 * `query-attachments`-bucket asset this same caller uploaded (validated
 * server-side) — obtained beforehand via the existing
 * `POST /media/upload-url` + `POST /media/confirm` flow.
 *
 * Query Category dropdown unit: `category_id`, if supplied, must reference
 * an existing `query_categories` row (validated server-side — see
 * queries.service.ts). `category` (legacy free text) is kept accepted here
 * too, purely for backward compatibility with any other existing caller —
 * the trainee-facing form (CreateQueryModal.tsx) now only ever sends
 * `category_id`, never `category`.
 */
export const createQueryRequestSchema = z.object({
  subject: z.string().min(1),
  category: z.string().min(1).nullable().optional(),
  category_id: idSchema.optional(),
  description: z.string().min(1),
  course_id: idSchema.optional(),
  priority: queryPrioritySchema.optional(),
  media_asset_id: idSchema.optional(),
});
export type CreateQueryRequest = z.infer<typeof createQueryRequestSchema>;

/**
 * Phase 6.6 — Admin Query Queue (SYSTEM_PLAN.md §14.7/§22/§26, permission
 * `query.manage` — the one permission code the plan itself names for query
 * oversight: "support-permission holders ... see all"). All queries, not
 * self-scoped — `user_full_name` is the one field this shape adds over
 * `queryResponseSchema`, so an admin can tell whose ticket each row is
 * (mirrors `AdminAssessmentAttempt`'s own `user_full_name` convenience join
 * in assessment-grading.ts). No SUPPORT role is introduced anywhere here —
 * authorization is the existing permission code, not a role name.
 */
export const adminQueryResponseSchema = queryResponseSchema.extend({
  user_full_name: z.string(),
});
export type AdminQueryResponse = z.infer<typeof adminQueryResponseSchema>;

export const adminQueryListResponseSchema = apiPaginatedSchema(adminQueryResponseSchema);
export type AdminQueryListResponse = z.infer<typeof adminQueryListResponseSchema>;

/**
 * GET /api/v1/admin/queries query params. `status`/`priority` filter on
 * the fixed enums already defined above; `category` filters on the exact
 * value of that free-text column (§14.7 defines no `query_categories`
 * lookup table — categories are whatever a trainee typed at ticket
 * creation, so filtering is by value, not by a managed id — the admin UI
 * populates its options from `GET /admin/queries/categories` below rather
 * than requiring an admin to know/retype an exact string).
 */
export const listAdminQueriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: queryStatusSchema.optional(),
  priority: queryPrioritySchema.optional(),
  category: z.string().min(1).optional(),
});
export type ListAdminQueriesQuery = z.infer<typeof listAdminQueriesQuerySchema>;

/** GET /api/v1/admin/queries/categories — the distinct, non-null `category` values currently in use, for the admin filter dropdown. */
export const queryCategoryListResponseSchema = apiSuccessSchema(z.array(z.string()));
export type QueryCategoryListResponse = z.infer<typeof queryCategoryListResponseSchema>;

/**
 * Phase 6.7 — Admin Query Management (SYSTEM_PLAN.md §14.7/§22/§26,
 * permission `query.manage`). `GET /admin/queries/:id` is the same full
 * ticket-plus-thread shape as the trainer's own `GET /queries/:id`
 * (§14.7's "conversation thread"), with `user_full_name` added so the
 * admin sees whose ticket it is — not a separate support architecture,
 * the exact same `queries`/`query_messages`/`query_attachments` tables.
 */
export const adminQueryDetailSchema = adminQueryResponseSchema.extend({
  messages: z.array(queryMessageResponseSchema),
});
export type AdminQueryDetail = z.infer<typeof adminQueryDetailSchema>;

export const adminQueryDetailResponseSchema = apiSuccessSchema(adminQueryDetailSchema);
export type AdminQueryDetailResponse = z.infer<typeof adminQueryDetailResponseSchema>;

/**
 * PATCH /api/v1/admin/queries/:id — change `status` and/or (re)assign the
 * ticket. Both independently optional (omit to leave unchanged);
 * `assigned_to: null` explicitly unassigns (§14.7: `assigned_to` is
 * nullable, set-null on the assignee's own deletion). At least one field
 * must be supplied — an empty PATCH is rejected rather than silently
 * treated as a no-op, since a caller sending neither almost certainly made
 * a mistake.
 */
export const updateAdminQueryRequestSchema = z
  .object({
    status: queryStatusSchema.optional(),
    assigned_to: idSchema.nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.assigned_to !== undefined, {
    message: "Provide status and/or assigned_to.",
  });
export type UpdateAdminQueryRequest = z.infer<typeof updateAdminQueryRequestSchema>;

/**
 * GET /api/v1/admin/queries/assignees — every ACTIVE profile whose role
 * holds `query.manage`, for the "Assign" dropdown. Derived from the
 * existing permission-table data (`roles` -> `role_permissions` ->
 * `permissions`), never a hard-coded SUPPORT role or role-name check —
 * whichever role(s) a future migration grants `query.manage` to appear
 * here automatically, with no code change (SYSTEM_PLAN.md §5).
 */
export const queryManagerSchema = z.object({
  id: idSchema,
  full_name: z.string(),
});
export type QueryManager = z.infer<typeof queryManagerSchema>;

export const queryManagerListResponseSchema = apiSuccessSchema(z.array(queryManagerSchema));
export type QueryManagerListResponse = z.infer<typeof queryManagerListResponseSchema>;

// ---------------------------------------------------------------------------
// Query Categories (Query Category dropdown unit) — the NEW admin-managed
// `query_categories` lookup table, mirroring resource-categories.ts/
// course-categories.ts field-for-field. Deliberately distinct from
// `queryCategoryListResponseSchema` above: that one is the untouched LEGACY
// endpoint (`GET /admin/queries/categories`) returning the distinct
// free-text `Query.category` values already in use, for the admin queue's
// filter dropdown only. These schemas back the real entity: `GET
// /queries/categories` (trainee, active-only) and the full admin CRUD at
// `/admin/query-categories` (permission `query.manage`).
// ---------------------------------------------------------------------------

export const queryCategoryResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  department_id: idSchema.nullable(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type QueryCategoryResponse = z.infer<typeof queryCategoryResponseSchema>;

/** GET /api/v1/admin/query-categories — paginated, admin CRUD list. */
export const queryCategoryRecordListResponseSchema = apiPaginatedSchema(queryCategoryResponseSchema);
export type QueryCategoryRecordListResponse = z.infer<typeof queryCategoryRecordListResponseSchema>;

/** GET /api/v1/queries/categories — active-only, non-paginated, for the trainee create-form dropdown. */
export const visibleQueryCategoryListResponseSchema = apiSuccessSchema(
  z.array(queryCategoryResponseSchema),
);
export type VisibleQueryCategoryListResponse = z.infer<
  typeof visibleQueryCategoryListResponseSchema
>;

export const listQueryCategoryRecordsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
export type ListQueryCategoryRecordsQuery = z.infer<typeof listQueryCategoryRecordsQuerySchema>;

/** `department_id` (Department -> Category -> Training Content hierarchy unit): null/omitted = a global category. */
export const createQueryCategoryRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  department_id: idSchema.nullable().optional(),
});
export type CreateQueryCategoryRequest = z.infer<typeof createQueryCategoryRequestSchema>;

export const updateQueryCategoryRequestSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  department_id: idSchema.nullable().optional(),
});
export type UpdateQueryCategoryRequest = z.infer<typeof updateQueryCategoryRequestSchema>;
