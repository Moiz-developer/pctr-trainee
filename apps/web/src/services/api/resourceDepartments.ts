import {
  resourceDepartmentsResponseSchema,
  type DepartmentResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

export async function getResourceDepartments(resourceId: string): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/resources/${resourceId}/departments`);
  return resourceDepartmentsResponseSchema.parse(body).data;
}

export async function setResourceDepartments(
  resourceId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/resources/${resourceId}/departments`, {
    method: "PUT",
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return resourceDepartmentsResponseSchema.parse(body).data;
}
