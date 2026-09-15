import { meResponseSchema, type Identity } from "@internal-training/shared";
import { apiFetch } from "./client";

/** GET /api/v1/auth/me (SYSTEM_PLAN.md §26). */
export async function getMe(): Promise<Identity> {
  const body = await apiFetch<unknown>("/auth/me");
  return meResponseSchema.parse(body).data;
}
