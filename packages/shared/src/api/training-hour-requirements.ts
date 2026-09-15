import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema, apiSuccessSchema } from "./common.js";

/**
 * Admin configuration for `training_hour_requirements` (SYSTEM_PLAN.md
 * §14.3): the "hours allocated" side of the trainee hours-consumed-vs-
 * allocated dashboard figure. List + create only — no update/delete
 * endpoint exists, matching the table's own immutable-historical-row design
 * ("a new row with a later effective_from supersedes an old one", mirrored
 * from this project's other append-only config tables); see this unit's
 * implementation report.
 */
export const trainingHourRequirementScopeSchema = z.enum(["DEPARTMENT", "USER"]);
export type TrainingHourRequirementScope = z.infer<typeof trainingHourRequirementScopeSchema>;

export const trainingHourRequirementSchema = z.object({
  id: idSchema,
  scope: trainingHourRequirementScopeSchema,
  department_id: idSchema.nullable(),
  department_name: z.string().nullable(),
  user_id: idSchema.nullable(),
  user_full_name: z.string().nullable(),
  required_hours: z.number(),
  effective_from: z.string(),
  created_by: idSchema.nullable(),
  created_at: isoDateStringSchema,
});
export type TrainingHourRequirement = z.infer<typeof trainingHourRequirementSchema>;

export const trainingHourRequirementListResponseSchema = apiPaginatedSchema(
  trainingHourRequirementSchema,
);
export type TrainingHourRequirementListResponse = z.infer<
  typeof trainingHourRequirementListResponseSchema
>;

export const trainingHourRequirementResponseSchema = apiSuccessSchema(
  trainingHourRequirementSchema,
);
export type TrainingHourRequirementResponse = z.infer<typeof trainingHourRequirementResponseSchema>;

export const listTrainingHourRequirementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListTrainingHourRequirementsQuery = z.infer<
  typeof listTrainingHourRequirementsQuerySchema
>;

/**
 * POST body. The CHECK constraint's "exactly one of department_id/user_id,
 * matching scope" (§14.3) is enforced here too, client- and server-side, not
 * just at the database layer — matching this project's existing pattern of
 * validating business rules at the API boundary rather than surfacing raw
 * constraint-violation errors to the client.
 */
export const createTrainingHourRequirementRequestSchema = z
  .object({
    scope: trainingHourRequirementScopeSchema,
    department_id: idSchema.optional(),
    user_id: idSchema.optional(),
    required_hours: z.number().positive(),
    effective_from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "effective_from must be an ISO date (YYYY-MM-DD)."),
  })
  .refine(
    (data) =>
      (data.scope === "DEPARTMENT" && !!data.department_id && !data.user_id) ||
      (data.scope === "USER" && !!data.user_id && !data.department_id),
    {
      message: "Exactly one of department_id/user_id must be set, matching scope.",
      path: ["scope"],
    },
  );
export type CreateTrainingHourRequirementRequest = z.infer<
  typeof createTrainingHourRequirementRequestSchema
>;
