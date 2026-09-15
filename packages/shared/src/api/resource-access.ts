import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * Consistent granular access control unit: explicit per-user Resource
 * access grants, mirroring packages/shared/src/api/course-access.ts
 * field-for-field (same soft-revocable, one-row-per-pairing shape).
 * Permission `resource.manage` — the one permission already gating the
 * whole Resource Library feature (no new permission created, matching this
 * unit's "do not invent a new authorization architecture" instruction).
 * `user_id` uses the same loose `idSchema` the rest of this module's
 * request schemas use (unlike course-access.ts's one-off strict `z.uuid()`,
 * which was driven by that unit's own explicit spec, not a general
 * convention).
 */
export const grantResourceAccessRequestSchema = z.object({
  user_id: idSchema,
});
export type GrantResourceAccessRequest = z.infer<typeof grantResourceAccessRequestSchema>;

export const resourceAccessResponseSchema = z.object({
  id: idSchema,
  resource_id: idSchema,
  user_id: idSchema,
  granted_by: idSchema.nullable(),
  granted_at: isoDateStringSchema,
  revoked_by: idSchema.nullable(),
  revoked_at: isoDateStringSchema.nullable(),
  is_active: z.boolean(),
});
export type ResourceAccessResponse = z.infer<typeof resourceAccessResponseSchema>;

export const resourceAccessListResponseSchema = apiPaginatedSchema(resourceAccessResponseSchema);
export type ResourceAccessListResponse = z.infer<typeof resourceAccessListResponseSchema>;

export const listResourceAccessQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListResourceAccessQuery = z.infer<typeof listResourceAccessQuerySchema>;
