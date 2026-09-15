import { dashboardResponseSchema, type DashboardData } from "@internal-training/shared";
import { apiFetch } from "./client";

/** GET /api/v1/dashboard (SYSTEM_PLAN.md §26/§40 Phase 3) — self-scoped, real hours/progress/continue-learning data. */
export async function getDashboard(): Promise<DashboardData> {
  const body = await apiFetch<unknown>("/dashboard");
  return dashboardResponseSchema.parse(body).data;
}
