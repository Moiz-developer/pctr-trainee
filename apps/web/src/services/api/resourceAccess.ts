import {
  apiSuccessSchema,
  resourceAccessListResponseSchema,
  resourceAccessResponseSchema,
  type ResourceAccessResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const accessEnvelope = apiSuccessSchema(resourceAccessResponseSchema);

export async function listResourceAccess(resourceId: string): Promise<ResourceAccessResponse[]> {
  const body = await apiFetch<unknown>(`/admin/resources/${resourceId}/access?pageSize=100`);
  return resourceAccessListResponseSchema.parse(body).data;
}

/** Grants access — also reactivates a previously-revoked grant (mirrors grantCourseAccess). */
export async function grantResourceAccess(
  resourceId: string,
  userId: string,
): Promise<ResourceAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/resources/${resourceId}/access`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return accessEnvelope.parse(body).data;
}

export async function revokeResourceAccess(
  resourceId: string,
  userId: string,
): Promise<ResourceAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/resources/${resourceId}/access/${userId}`, {
    method: "DELETE",
  });
  return accessEnvelope.parse(body).data;
}
