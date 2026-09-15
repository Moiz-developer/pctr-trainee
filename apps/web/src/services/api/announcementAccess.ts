import {
  apiSuccessSchema,
  announcementAccessListResponseSchema,
  announcementAccessResponseSchema,
  type AnnouncementAccessResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const accessEnvelope = apiSuccessSchema(announcementAccessResponseSchema);

export async function listAnnouncementAccess(
  announcementId: string,
): Promise<AnnouncementAccessResponse[]> {
  const body = await apiFetch<unknown>(
    `/admin/announcements/${announcementId}/access?pageSize=100`,
  );
  return announcementAccessListResponseSchema.parse(body).data;
}

/** Grants access — also reactivates a previously-revoked grant (mirrors grantResourceAccess/grantCourseAccess). */
export async function grantAnnouncementAccess(
  announcementId: string,
  userId: string,
): Promise<AnnouncementAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${announcementId}/access`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return accessEnvelope.parse(body).data;
}

export async function revokeAnnouncementAccess(
  announcementId: string,
  userId: string,
): Promise<AnnouncementAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${announcementId}/access/${userId}`, {
    method: "DELETE",
  });
  return accessEnvelope.parse(body).data;
}
