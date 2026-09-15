import {
  announcementDepartmentsResponseSchema,
  type DepartmentResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

export async function getAnnouncementDepartments(announcementId: string): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/announcements/${announcementId}/departments`);
  return announcementDepartmentsResponseSchema.parse(body).data;
}

export async function setAnnouncementDepartments(
  announcementId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/announcements/${announcementId}/departments`, {
    method: "PUT",
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return announcementDepartmentsResponseSchema.parse(body).data;
}
