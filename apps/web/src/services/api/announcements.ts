import {
  apiSuccessSchema,
  announcementListResponseSchema,
  announcementResponseSchema,
  announcementReadStateResponseSchema,
  type AnnouncementListResponse,
  type AnnouncementResponse,
  type AnnouncementReadState,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const announcementEnvelope = apiSuccessSchema(announcementResponseSchema);

/** GET /api/v1/announcements — PUBLISHED, department-visible announcements only (SYSTEM_PLAN.md §14.6/§21/§26). */
export async function listAnnouncements(
  params: { page?: number; pageSize?: number } = {},
): Promise<AnnouncementListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 20));
  const body = await apiFetch<unknown>(`/announcements?${qs.toString()}`);
  return announcementListResponseSchema.parse(body);
}

/** GET /api/v1/announcements/:id — marks it read as a side effect (server-side). */
export async function getAnnouncementDetail(id: string): Promise<AnnouncementResponse> {
  const body = await apiFetch<unknown>(`/announcements/${id}`);
  return announcementEnvelope.parse(body).data;
}

/** POST /api/v1/announcements/:id/ack */
export async function acknowledgeAnnouncement(id: string): Promise<AnnouncementReadState> {
  const body = await apiFetch<unknown>(`/announcements/${id}/ack`, { method: "POST" });
  return announcementReadStateResponseSchema.parse(body).data;
}

/** POST /api/v1/announcements/:id/dismiss */
export async function dismissAnnouncement(id: string): Promise<AnnouncementReadState> {
  const body = await apiFetch<unknown>(`/announcements/${id}/dismiss`, { method: "POST" });
  return announcementReadStateResponseSchema.parse(body).data;
}
