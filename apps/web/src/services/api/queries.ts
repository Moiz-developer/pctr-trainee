import {
  apiSuccessSchema,
  queryListResponseSchema,
  queryResponseSchema,
  queryDetailResponseSchema,
  queryMessageDetailResponseSchema,
  visibleQueryCategoryListResponseSchema,
  type CreateQueryRequest,
  type CreateQueryMessageRequest,
  type QueryListResponse,
  type QueryResponse,
  type QueryDetail,
  type QueryMessageResponse,
  type QueryCategoryResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const queryEnvelope = apiSuccessSchema(queryResponseSchema);

/** GET /api/v1/queries — the caller's own tickets only (SYSTEM_PLAN.md §14.7/§22/§26). */
export async function listMyQueries(
  params: { page?: number; pageSize?: number } = {},
): Promise<QueryListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  const body = await apiFetch<unknown>(`/queries?${qs.toString()}`);
  return queryListResponseSchema.parse(body);
}

/** GET /api/v1/queries/categories — active Query Categories, for the create-form dropdown. */
export async function listQueryCategories(): Promise<QueryCategoryResponse[]> {
  const body = await apiFetch<unknown>("/queries/categories");
  return visibleQueryCategoryListResponseSchema.parse(body).data;
}

/** POST /api/v1/queries — create a new support ticket owned by the caller. */
export async function createQuery(input: CreateQueryRequest): Promise<QueryResponse> {
  const body = await apiFetch<unknown>("/queries", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return queryEnvelope.parse(body).data;
}

/** GET /api/v1/queries/:id — the caller's own ticket, with its full conversation thread (Phase 6.4). */
export async function getQueryDetail(id: string): Promise<QueryDetail> {
  const body = await apiFetch<unknown>(`/queries/${id}`);
  return queryDetailResponseSchema.parse(body).data;
}

/** POST /api/v1/queries/:id/messages — post a follow-up message on the caller's own ticket (Phase 6.4). */
export async function createQueryMessage(
  id: string,
  input: CreateQueryMessageRequest,
): Promise<QueryMessageResponse> {
  const body = await apiFetch<unknown>(`/queries/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return queryMessageDetailResponseSchema.parse(body).data;
}
