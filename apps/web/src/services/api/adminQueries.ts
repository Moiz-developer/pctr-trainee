import {
  adminQueryListResponseSchema,
  adminQueryDetailResponseSchema,
  queryCategoryListResponseSchema,
  queryManagerListResponseSchema,
  queryMessageDetailResponseSchema,
  apiSuccessSchema,
  adminQueryResponseSchema,
  type AdminQueryListResponse,
  type AdminQueryDetail,
  type CreateQueryMessageRequest,
  type QueryManager,
  type QueryMessageResponse,
  type QueryPriority,
  type QueryStatus,
  type UpdateAdminQueryRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const adminQueryEnvelope = apiSuccessSchema(adminQueryResponseSchema);

/** GET /api/v1/admin/queries (SYSTEM_PLAN.md §14.7/§22/§26, permission `query.manage`) — every ticket, filterable. */
export async function listAdminQueries(
  params: {
    page?: number;
    pageSize?: number;
    status?: QueryStatus;
    priority?: QueryPriority;
    category?: string;
  } = {},
): Promise<AdminQueryListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  if (params.status) qs.set("status", params.status);
  if (params.priority) qs.set("priority", params.priority);
  if (params.category) qs.set("category", params.category);
  const body = await apiFetch<unknown>(`/admin/queries?${qs.toString()}`);
  return adminQueryListResponseSchema.parse(body);
}

/** GET /api/v1/admin/queries/categories — distinct category values in use, for the filter dropdown. */
export async function listQueryCategories(): Promise<string[]> {
  const body = await apiFetch<unknown>("/admin/queries/categories");
  return queryCategoryListResponseSchema.parse(body).data;
}

/** GET /api/v1/admin/queries/assignees — active users who hold `query.manage`, for the "Assign" dropdown (Phase 6.7). */
export async function listQueryManagers(): Promise<QueryManager[]> {
  const body = await apiFetch<unknown>("/admin/queries/assignees");
  return queryManagerListResponseSchema.parse(body).data;
}

/** GET /api/v1/admin/queries/:id (Phase 6.7) — the full ticket plus its conversation thread, any ticket (permission `query.manage`). */
export async function getAdminQueryDetail(id: string): Promise<AdminQueryDetail> {
  const body = await apiFetch<unknown>(`/admin/queries/${id}`);
  return adminQueryDetailResponseSchema.parse(body).data;
}

/** POST /api/v1/admin/queries/:id/messages (Phase 6.7) — an admin/support reply, optionally with an attachment. */
export async function createAdminQueryMessage(
  id: string,
  input: CreateQueryMessageRequest,
): Promise<QueryMessageResponse> {
  const body = await apiFetch<unknown>(`/admin/queries/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return queryMessageDetailResponseSchema.parse(body).data;
}

/** PATCH /api/v1/admin/queries/:id (Phase 6.7) — change status and/or (re)assign the ticket. */
export async function updateAdminQuery(id: string, input: UpdateAdminQueryRequest) {
  const body = await apiFetch<unknown>(`/admin/queries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return adminQueryEnvelope.parse(body).data;
}
