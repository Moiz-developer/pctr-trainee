import { Router } from "express";
import { healthResponseSchema, type HealthResponse } from "@internal-training/shared";

export const routes: Router = Router();

// Namespace health check, distinct from the infrastructure-level GET /health in app.ts.
// Domain routes (users, departments, courses, ...) are mounted here in later steps.
routes.get("/health", (_req, res) => {
  const body: HealthResponse = healthResponseSchema.parse({ data: { status: "ok" } });
  res.json(body);
});
