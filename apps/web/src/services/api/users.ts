import {
  adminUserListResponseSchema,
  adminUserResponseSchema,
  apiSuccessSchema,
  type AdminUserListResponse,
  type AdminUserResponse,
  type AssignUserDepartmentRequest,
  type CreateUserRequest,
  type UpdateUserRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const adminUserEnvelope = apiSuccessSchema(adminUserResponseSchema);

/** GET /api/v1/admin/users — used by the Course Access user picker. */
export async function searchUsers(search = ""): Promise<AdminUserResponse[]> {
  const qs = new URLSearchParams({ pageSize: "100" });
  if (search) qs.set("search", search);
  const body = await apiFetch<unknown>(`/admin/users?${qs.toString()}`);
  return adminUserListResponseSchema.parse(body).data;
}

/** GET /api/v1/admin/users — the Admin Users page's full roster, with pagination/search/status filter. */
export async function listUsers(
  params: { page?: number; pageSize?: number; search?: string; status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" } = {},
): Promise<AdminUserListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  const body = await apiFetch<unknown>(`/admin/users?${qs.toString()}`);
  return adminUserListResponseSchema.parse(body);
}

/** POST /api/v1/admin/users — Supabase invite flow; no admin-set password (none accepted by the API). */
export async function createUser(input: CreateUserRequest): Promise<AdminUserResponse> {
  const body = await apiFetch<unknown>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return adminUserEnvelope.parse(body).data;
}

export async function updateUser(id: string, input: UpdateUserRequest): Promise<AdminUserResponse> {
  const body = await apiFetch<unknown>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return adminUserEnvelope.parse(body).data;
}

export async function assignUserDepartment(
  userId: string,
  input: AssignUserDepartmentRequest,
): Promise<AdminUserResponse> {
  const body = await apiFetch<unknown>(`/admin/users/${userId}/departments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return adminUserEnvelope.parse(body).data;
}

export async function removeUserDepartment(
  userId: string,
  departmentId: string,
): Promise<AdminUserResponse> {
  const body = await apiFetch<unknown>(`/admin/users/${userId}/departments/${departmentId}`, {
    method: "DELETE",
  });
  return adminUserEnvelope.parse(body).data;
}
