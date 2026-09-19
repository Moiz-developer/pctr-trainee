import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * Explicit per-user Policy access grants, mirroring resource-access.ts
 * field-for-field (same soft-revocable, one-row-per-pairing shape).
 * Permission `policy.manage` — the one permission already gating all Policy
 * administration (no new permission created).
 */
export const grantPolicyAccessRequestSchema = z.object({
  user_id: idSchema,
});
export type GrantPolicyAccessRequest = z.infer<typeof grantPolicyAccessRequestSchema>;

export const policyAccessResponseSchema = z.object({
  id: idSchema,
  policy_id: idSchema,
  user_id: idSchema,
  granted_by: idSchema.nullable(),
  granted_at: isoDateStringSchema,
  revoked_by: idSchema.nullable(),
  revoked_at: isoDateStringSchema.nullable(),
  is_active: z.boolean(),
});
export type PolicyAccessResponse = z.infer<typeof policyAccessResponseSchema>;

export const policyAccessListResponseSchema = apiPaginatedSchema(policyAccessResponseSchema);
export type PolicyAccessListResponse = z.infer<typeof policyAccessListResponseSchema>;

export const listPolicyAccessQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListPolicyAccessQuery = z.infer<typeof listPolicyAccessQuerySchema>;
