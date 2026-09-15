import {
  courseDepartmentsResponseSchema,
  type DepartmentResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

export async function getCourseDepartments(courseId: string): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/departments`);
  return courseDepartmentsResponseSchema.parse(body).data;
}

export async function setCourseDepartments(
  courseId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/departments`, {
    method: "PUT",
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return courseDepartmentsResponseSchema.parse(body).data;
}
