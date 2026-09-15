import {
  apiSuccessSchema,
  resourceListResponseSchema,
  resourceResponseSchema,
  visibleResourceCategoryListResponseSchema,
  type ResourceListResponse,
  type ResourceResponse,
  type ResourceCategoryResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const resourceEnvelope = apiSuccessSchema(resourceResponseSchema);

/** GET /api/v1/resources — PUBLISHED, department-visible resources only (SYSTEM_PLAN.md §14.5/§20/§26). */
export async function listResources(
  params: { page?: number; pageSize?: number; category_id?: string } = {},
): Promise<ResourceListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  if (params.category_id) qs.set("category_id", params.category_id);
  const body = await apiFetch<unknown>(`/resources?${qs.toString()}`);
  return resourceListResponseSchema.parse(body);
}

/** GET /api/v1/resources/:id */
export async function getResourceDetail(id: string): Promise<ResourceResponse> {
  const body = await apiFetch<unknown>(`/resources/${id}`);
  return resourceEnvelope.parse(body).data;
}

/** GET /api/v1/resources/categories — active categories, for the trainee filter dropdown. */
export async function listResourceCategories(): Promise<ResourceCategoryResponse[]> {
  const body = await apiFetch<unknown>("/resources/categories");
  return visibleResourceCategoryListResponseSchema.parse(body).data;
}
