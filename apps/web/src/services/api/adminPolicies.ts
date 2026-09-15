import {
  apiSuccessSchema,
  adminPolicyListResponseSchema,
  adminPolicyResponseSchema,
  adminPolicyDetailResponseSchema,
  policyVersionResponseSchema,
  type AdminPolicyListResponse,
  type AdminPolicyResponse,
  type AdminPolicyDetail,
  type PolicyVersionResponse,
  type CreatePolicyRequest,
  type UpdatePolicyRequest,
  type CreatePolicyVersionRequest,
  type UpdatePolicyVersionRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const adminPolicyEnvelope = apiSuccessSchema(adminPolicyResponseSchema);
const policyVersionEnvelope = apiSuccessSchema(policyVersionResponseSchema);

/** GET /api/v1/admin/policies (permission `policy.manage` or `policy.version.activate`). */
export async function listAdminPolicies(
  params: { page?: number; pageSize?: number } = {},
): Promise<AdminPolicyListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  const body = await apiFetch<unknown>(`/admin/policies?${qs.toString()}`);
  return adminPolicyListResponseSchema.parse(body);
}

/** GET /api/v1/admin/policies/:id — the policy plus every version (active, archived, draft). */
export async function getAdminPolicy(id: string): Promise<AdminPolicyDetail> {
  const body = await apiFetch<unknown>(`/admin/policies/${id}`);
  return adminPolicyDetailResponseSchema.parse(body).data;
}

export async function createPolicy(input: CreatePolicyRequest): Promise<AdminPolicyResponse> {
  const body = await apiFetch<unknown>("/admin/policies", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return adminPolicyEnvelope.parse(body).data;
}

export async function updatePolicy(
  id: string,
  input: UpdatePolicyRequest,
): Promise<AdminPolicyResponse> {
  const body = await apiFetch<unknown>(`/admin/policies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return adminPolicyEnvelope.parse(body).data;
}

export async function createPolicyVersion(
  policyId: string,
  input: CreatePolicyVersionRequest,
): Promise<PolicyVersionResponse> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/versions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return policyVersionEnvelope.parse(body).data;
}

export async function updatePolicyVersion(
  policyId: string,
  versionId: string,
  input: UpdatePolicyVersionRequest,
): Promise<PolicyVersionResponse> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/versions/${versionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return policyVersionEnvelope.parse(body).data;
}

/** POST /api/v1/admin/policies/:policyId/versions/:versionId/activate (permission `policy.version.activate`). */
export async function activatePolicyVersion(
  policyId: string,
  versionId: string,
): Promise<AdminPolicyDetail> {
  const body = await apiFetch<unknown>(
    `/admin/policies/${policyId}/versions/${versionId}/activate`,
    { method: "POST" },
  );
  return adminPolicyDetailResponseSchema.parse(body).data;
}

/** POST /api/v1/admin/policies/:policyId/versions/:versionId/archive (permission `policy.version.activate`) — standalone archive, independent of activating a replacement. */
export async function archivePolicyVersion(
  policyId: string,
  versionId: string,
): Promise<AdminPolicyDetail> {
  const body = await apiFetch<unknown>(
    `/admin/policies/${policyId}/versions/${versionId}/archive`,
    { method: "POST" },
  );
  return adminPolicyDetailResponseSchema.parse(body).data;
}
