import {
  apiSuccessSchema,
  roleListResponseSchema,
  roleResponseSchema,
  permissionListResponseSchema,
  type RoleListResponse,
  type RoleResponse,
  type PermissionResponse,
  type CreateRoleRequest,
  type UpdateRoleRequest,
  type SetRolePermissionsRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const roleEnvelope = apiSuccessSchema(roleResponseSchema);

/** GET /api/v1/admin/roles (permission `role.manage`) — the admin Roles management page's full list. */
export async function listRoles(
  params: { page?: number; pageSize?: number } = {},
): Promise<RoleListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  const body = await apiFetch<unknown>(`/admin/roles?${qs.toString()}`);
  return roleListResponseSchema.parse(body);
}

export async function createRole(input: CreateRoleRequest): Promise<RoleResponse> {
  const body = await apiFetch<unknown>("/admin/roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return roleEnvelope.parse(body).data;
}

export async function updateRole(id: string, input: UpdateRoleRequest): Promise<RoleResponse> {
  const body = await apiFetch<unknown>(`/admin/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return roleEnvelope.parse(body).data;
}

/** PUT /api/v1/admin/roles/:id/permissions — whole-set-replace. */
export async function setRolePermissions(
  id: string,
  input: SetRolePermissionsRequest,
): Promise<RoleResponse> {
  const body = await apiFetch<unknown>(`/admin/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return roleEnvelope.parse(body).data;
}

/** GET /api/v1/admin/permissions (permission `role.manage`) — the full permission catalogue. */
export async function listAllPermissions(): Promise<PermissionResponse[]> {
  const body = await apiFetch<unknown>("/admin/permissions");
  return permissionListResponseSchema.parse(body).data;
}
