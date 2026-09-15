import {
  apiSuccessSchema,
  resourceCategoryListResponseSchema,
  resourceCategoryResponseSchema,
  type ResourceCategoryResponse,
  type CreateResourceCategoryRequest,
  type UpdateResourceCategoryRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const resourceCategoryEnvelope = apiSuccessSchema(resourceCategoryResponseSchema);

/** GET /api/v1/admin/resource-categories?pageSize=100 — full list for the admin management page. */
export async function listResourceCategories(
  params: { is_active?: boolean } = {},
): Promise<ResourceCategoryResponse[]> {
  const qs = new URLSearchParams();
  qs.set("pageSize", "100");
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const body = await apiFetch<unknown>(`/admin/resource-categories?${qs.toString()}`);
  return resourceCategoryListResponseSchema.parse(body).data;
}

/** Active-only categories, for the Resource create/edit form's dropdown. */
export async function listActiveResourceCategories(): Promise<ResourceCategoryResponse[]> {
  return listResourceCategories({ is_active: true });
}

export async function createResourceCategory(
  input: CreateResourceCategoryRequest,
): Promise<ResourceCategoryResponse> {
  const body = await apiFetch<unknown>("/admin/resource-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return resourceCategoryEnvelope.parse(body).data;
}

export async function updateResourceCategory(
  id: string,
  input: UpdateResourceCategoryRequest,
): Promise<ResourceCategoryResponse> {
  const body = await apiFetch<unknown>(`/admin/resource-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return resourceCategoryEnvelope.parse(body).data;
}
