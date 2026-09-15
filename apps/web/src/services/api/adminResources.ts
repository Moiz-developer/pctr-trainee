import {
  apiSuccessSchema,
  resourceListResponseSchema,
  resourceResponseSchema,
  type ResourceListResponse,
  type ResourceResponse,
  type ResourceStatus,
  type CreateResourceRequest,
  type UpdateResourceRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const resourceEnvelope = apiSuccessSchema(resourceResponseSchema);

/** GET /api/v1/admin/resources (permission `resource.manage`) — every resource, filterable by status/category. */
export async function listAdminResources(
  params: { page?: number; pageSize?: number; status?: ResourceStatus; category_id?: string } = {},
): Promise<ResourceListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  if (params.status) qs.set("status", params.status);
  if (params.category_id) qs.set("category_id", params.category_id);
  const body = await apiFetch<unknown>(`/admin/resources?${qs.toString()}`);
  return resourceListResponseSchema.parse(body);
}

export async function getAdminResource(id: string): Promise<ResourceResponse> {
  const body = await apiFetch<unknown>(`/admin/resources/${id}`);
  return resourceEnvelope.parse(body).data;
}

export async function createResource(input: CreateResourceRequest): Promise<ResourceResponse> {
  const body = await apiFetch<unknown>("/admin/resources", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return resourceEnvelope.parse(body).data;
}

export async function updateResource(
  id: string,
  input: UpdateResourceRequest,
): Promise<ResourceResponse> {
  const body = await apiFetch<unknown>(`/admin/resources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return resourceEnvelope.parse(body).data;
}
