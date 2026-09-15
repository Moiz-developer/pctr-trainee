import {
  apiSuccessSchema,
  queryCategoryRecordListResponseSchema,
  queryCategoryResponseSchema,
  type QueryCategoryResponse,
  type CreateQueryCategoryRequest,
  type UpdateQueryCategoryRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const queryCategoryEnvelope = apiSuccessSchema(queryCategoryResponseSchema);

/**
 * Admin Query Category CRUD (Query Category dropdown unit), mirrors
 * services/api/resourceCategories.ts exactly. Distinct from
 * services/api/adminQueries.ts's own `listQueryCategories` (the LEGACY
 * distinct-free-text-values fetcher for the admin queue's filter dropdown,
 * untouched) — different file, real admin-managed entity.
 */

/** GET /api/v1/admin/query-categories?pageSize=100 — full list for the admin management page. */
export async function listQueryCategories(
  params: { is_active?: boolean } = {},
): Promise<QueryCategoryResponse[]> {
  const qs = new URLSearchParams();
  qs.set("pageSize", "100");
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const body = await apiFetch<unknown>(`/admin/query-categories?${qs.toString()}`);
  return queryCategoryRecordListResponseSchema.parse(body).data;
}

/** Active-only categories, for the Query create form's dropdown (admin-permission variant — unused by the trainee form, which uses services/api/queries.ts's own listQueryCategories against GET /queries/categories instead). */
export async function listActiveQueryCategories(): Promise<QueryCategoryResponse[]> {
  return listQueryCategories({ is_active: true });
}

export async function createQueryCategory(
  input: CreateQueryCategoryRequest,
): Promise<QueryCategoryResponse> {
  const body = await apiFetch<unknown>("/admin/query-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return queryCategoryEnvelope.parse(body).data;
}

export async function updateQueryCategory(
  id: string,
  input: UpdateQueryCategoryRequest,
): Promise<QueryCategoryResponse> {
  const body = await apiFetch<unknown>(`/admin/query-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return queryCategoryEnvelope.parse(body).data;
}
