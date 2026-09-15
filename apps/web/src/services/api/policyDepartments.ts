import {
  policyDepartmentsResponseSchema,
  type DepartmentResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

export async function getPolicyDepartments(policyId: string): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/departments`);
  return policyDepartmentsResponseSchema.parse(body).data;
}

export async function setPolicyDepartments(
  policyId: string,
  departmentIds: string[],
): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>(`/admin/policies/${policyId}/departments`, {
    method: "PUT",
    body: JSON.stringify({ department_ids: departmentIds }),
  });
  return policyDepartmentsResponseSchema.parse(body).data;
}
