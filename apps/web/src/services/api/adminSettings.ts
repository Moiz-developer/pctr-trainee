import {
  apiSuccessSchema,
  systemSettingsResponseSchema,
  type SystemSettingsResponse,
  type UpdateSystemSettingsRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const settingsEnvelope = apiSuccessSchema(systemSettingsResponseSchema);

/** GET /api/v1/admin/settings (permission `system.manage`). */
export async function getSystemSettings(): Promise<SystemSettingsResponse> {
  const body = await apiFetch<unknown>("/admin/settings");
  return settingsEnvelope.parse(body).data;
}

/** PATCH /api/v1/admin/settings (permission `system.manage`) — partial update. */
export async function updateSystemSettings(
  input: UpdateSystemSettingsRequest,
): Promise<SystemSettingsResponse> {
  const body = await apiFetch<unknown>("/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return settingsEnvelope.parse(body).data;
}
