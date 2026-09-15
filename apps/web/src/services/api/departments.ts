import {
  apiSuccessSchema,
  departmentListResponseSchema,
  departmentResponseSchema,
  type CreateDepartmentRequest,
  type DepartmentListResponse,
  type DepartmentResponse,
  type UpdateDepartmentRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const departmentEnvelope = apiSuccessSchema(departmentResponseSchema);

/**
 * Departments for the course-assignment multi-select. `pageSize=100` (the
 * API's max) covers this project's scale without needing pagination
 * controls in a picker — see this unit's implementation report.
 */
export async function listAllDepartments(): Promise<DepartmentResponse[]> {
  const body = await apiFetch<unknown>("/admin/departments?pageSize=100&is_active=true");
  return departmentListResponseSchema.parse(body).data;
}

/** GET /api/v1/admin/departments — the Admin Departments page's full list (active + inactive). */
export async function listDepartments(
  params: { page?: number; pageSize?: number; is_active?: boolean } = {},
): Promise<DepartmentListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const body = await apiFetch<unknown>(`/admin/departments?${qs.toString()}`);
  return departmentListResponseSchema.parse(body);
}

export async function createDepartment(
  input: CreateDepartmentRequest,
): Promise<DepartmentResponse> {
  const body = await apiFetch<unknown>("/admin/departments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return departmentEnvelope.parse(body).data;
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentRequest,
): Promise<DepartmentResponse> {
  const body = await apiFetch<unknown>(`/admin/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return departmentEnvelope.parse(body).data;
}
