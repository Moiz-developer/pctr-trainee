import {
  apiSuccessSchema,
  policyAccessListResponseSchema,
  policyAccessResponseSchema,
  type PolicyAccessResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const accessEnvelope = apiSuccessSchema(policyAccessResponseSchema);

export async function listPolicyAccess(policyId: string): Promise<PolicyAccessResponse[]> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/access?pageSize=100`);
  return policyAccessListResponseSchema.parse(body).data;
}

/** Grants access — also reactivates a previously-revoked grant (mirrors grantResourceAccess). */
export async function grantPolicyAccess(
  policyId: string,
  userId: string,
): Promise<PolicyAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/access`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return accessEnvelope.parse(body).data;
}

export async function revokePolicyAccess(
  policyId: string,
  userId: string,
): Promise<PolicyAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/access/${userId}`, {
    method: "DELETE",
  });
  return accessEnvelope.parse(body).data;
}
