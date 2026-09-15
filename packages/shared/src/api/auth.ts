import { z } from "zod";
import { idSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";

/**
 * GET /api/v1/auth/me (SYSTEM_PLAN.md §26: "returns profile + permissions +
 * departments"). Field names mirror apps/api/src/modules/auth/auth.routes.ts's
 * actual response verbatim (camelCase, not snake_case like the admin-users/
 * departments DTOs) — that response shape is already implemented and tested;
 * this schema describes it, it does not change it.
 */
export const identitySchema = z.object({
  id: idSchema,
  employeeId: z.string(),
  fullName: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  role: z.object({ id: idSchema, code: z.string(), name: z.string() }),
  permissions: z.array(z.string()),
  departmentIds: z.array(idSchema),
});
export type Identity = z.infer<typeof identitySchema>;

export const meResponseSchema = apiSuccessSchema(identitySchema);
export type MeResponse = z.infer<typeof meResponseSchema>;
