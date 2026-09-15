import {
  apiSuccessSchema,
  adminAnnouncementListResponseSchema,
  adminAnnouncementResponseSchema,
  type AdminAnnouncementListResponse,
  type AdminAnnouncementResponse,
  type AnnouncementStatus,
  type AnnouncementPriority,
  type CreateAnnouncementRequest,
  type UpdateAnnouncementRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const adminAnnouncementEnvelope = apiSuccessSchema(adminAnnouncementResponseSchema);

/** GET /api/v1/admin/announcements (permission `announcement.manage` or `announcement.publish`). */
export async function listAdminAnnouncements(
  params: {
    page?: number;
    pageSize?: number;
    status?: AnnouncementStatus;
    priority?: AnnouncementPriority;
  } = {},
): Promise<AdminAnnouncementListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  if (params.status) qs.set("status", params.status);
  if (params.priority) qs.set("priority", params.priority);
  const body = await apiFetch<unknown>(`/admin/announcements?${qs.toString()}`);
  return adminAnnouncementListResponseSchema.parse(body);
}

export async function getAdminAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${id}`);
  return adminAnnouncementEnvelope.parse(body).data;
}

export async function createAnnouncement(
  input: CreateAnnouncementRequest,
): Promise<AdminAnnouncementResponse> {
  const body = await apiFetch<unknown>("/admin/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return adminAnnouncementEnvelope.parse(body).data;
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementRequest,
): Promise<AdminAnnouncementResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return adminAnnouncementEnvelope.parse(body).data;
}

/** POST /api/v1/admin/announcements/:id/publish (permission `announcement.publish`). */
export async function publishAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${id}/publish`, { method: "POST" });
  return adminAnnouncementEnvelope.parse(body).data;
}

/** POST /api/v1/admin/announcements/:id/archive (permission `announcement.manage`). */
export async function archiveAnnouncement(id: string): Promise<AdminAnnouncementResponse> {
  const body = await apiFetch<unknown>(`/admin/announcements/${id}/archive`, { method: "POST" });
  return adminAnnouncementEnvelope.parse(body).data;
}
