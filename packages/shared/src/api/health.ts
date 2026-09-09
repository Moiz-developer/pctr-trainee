import { z } from "zod";
import { apiSuccessSchema } from "./common.js";

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
});

/**
 * Contract for GET /health and GET /api/v1/health: { "data": { "status": "ok" } }
 */
export const healthResponseSchema = apiSuccessSchema(healthStatusSchema);
export type HealthResponse = z.infer<typeof healthResponseSchema>;
