import { z } from "zod";

/**
 * Generic wrapper for the platform's success response envelope: { "data": ... }
 * (see SYSTEM_PLAN.md §26, API Architecture).
 *
 * Implemented as a schema factory rather than a single generic schema instance,
 * since Zod schemas are concrete per-shape — this keeps each endpoint's response
 * fully validated (not just typed) while staying reusable across future modules.
 */
export function apiSuccessSchema<DataSchema extends z.ZodType>(dataSchema: DataSchema) {
  return z.object({
    data: dataSchema,
  });
}

export type ApiSuccess<T> = { data: T };

/**
 * The platform's error response envelope: { "error": { code, message, fields? } }
 * (see SYSTEM_PLAN.md §26/§30/§31).
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
