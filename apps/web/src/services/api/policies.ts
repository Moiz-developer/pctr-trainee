import {
  apiSuccessSchema,
  policyListResponseSchema,
  policyResponseSchema,
  type PolicyListResponse,
  type PolicyResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const policyEnvelope = apiSuccessSchema(policyResponseSchema);

/** GET /api/v1/policies — only policies with a currently active version (SYSTEM_PLAN.md §14.8/§23/§26). */
export async function listPolicies(
  params: { page?: number; pageSize?: number } = {},
): Promise<PolicyListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  const body = await apiFetch<unknown>(`/policies?${qs.toString()}`);
  return policyListResponseSchema.parse(body);
}

/** GET /api/v1/policies/:slug */
export async function getPolicyDetail(slug: string): Promise<PolicyResponse> {
  const body = await apiFetch<unknown>(`/policies/${slug}`);
  return policyEnvelope.parse(body).data;
}
