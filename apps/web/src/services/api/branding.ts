import {
  publicBrandingDetailResponseSchema,
  type PublicBrandingResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

/** GET /api/v1/settings/branding — public (works before sign-in); the login page needs it. */
export async function getPublicBranding(): Promise<PublicBrandingResponse> {
  const body = await apiFetch<unknown>("/settings/branding");
  return publicBrandingDetailResponseSchema.parse(body).data;
}
