import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, GraduationCap, Pencil, Plus, Search, UserCircle } from "lucide-react";
import type { AdminUserResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listUsers, updateUser } from "../../../services/api/users";
import { listDepartments } from "../../../services/api/departments";
import { listRoles } from "../../../services/api/roles";
import { CreateUserModal } from "./CreateUserModal";
import { EditUserModal } from "./EditUserModal";
import { ManageUserDepartmentsModal } from "./ManageUserDepartmentsModal";
import { UserTrainingAccessModal } from "./UserTrainingAccessModal";

const STATUS_TONE: Record<AdminUserResponse["status"], BadgeTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
};

/**
 * Admin Users management (closes the Phase 1 gap the Phase 2J audit
 * identified: the full backend — GET/POST/PATCH /admin/users, POST/DELETE
 * .../departments — already existed with no UI). Mirrors
 * AdminCoursesListPage.tsx's list+search+create-modal shape.
 *
 * `availableRoles` now comes from the real `GET /admin/roles` endpoint
 * (Admin Role & Permission Management unit) — replaces the former
 * roster-scraping workaround (deriving "available roles" from whichever
 * roles happened to already be held by users in the currently-loaded page),
 * which meant a role with zero existing users was invisible here even
 * though it existed. `role.manage` is the read gate on that endpoint;
 * `<Can>` isn't wrapped around this fetch specifically since a
 * `role.manage`-less admin simply gets a 403 the query surfaces like any
 * other failed fetch, not a hard requirement to hide the whole page.
 */
export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [managingDepartmentsUserId, setManagingDepartmentsUserId] = useState<string | null>(null);
  const [managingTrainingAccessUserId, setManagingTrainingAccessUserId] = useState<string | null>(
    null,
  );

  const usersQuery = useQuery({
    queryKey: ["admin-users", submittedSearch],
    queryFn: () => listUsers({ search: submittedSearch || undefined, pageSize: 100 }),
  });

  const departmentsQuery = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => listDepartments(),
  });
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsQuery.data?.data ?? []) {
      map.set(department.id, department.name);
    }
    return map;
  }, [departmentsQuery.data]);

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => listRoles(),
  });
  const availableRoles = useMemo(
    () =>
      (rolesQuery.data?.data ?? [])
        .map((role) => ({ id: role.id, code: role.code, name: role.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rolesQuery.data],
  );

  const editingUser = usersQuery.data?.data.find((u) => u.id === editingUserId) ?? null;
  const managingDepartmentsUser =
    usersQuery.data?.data.find((u) => u.id === managingDepartmentsUserId) ?? null;
  const managingTrainingAccessUser =
    usersQuery.data?.data.find((u) => u.id === managingTrainingAccessUserId) ?? null;

  const toggleActive = useMutation({
    mutationFn: (target: AdminUserResponse) =>
      updateUser(target.id, { status: target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage trainee, trainer, and admin accounts and their department access.
          </p>
        </div>
        <Can permission="user.create">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New User
          </Button>
        </Can>
      </div>

      <Card>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, employee ID, or email…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <RemoteDataView
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          error={usersQuery.error}
          data={usersQuery.data?.data}
          onRetry={() => void usersQuery.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No users found"
          emptyDescription="Invite a user to get started, or adjust your search."
        >
          {(users) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Contact</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Departments</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-5 w-5 text-slate-400" aria-hidden="true" />
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-400">{user.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        <p>{user.email}</p>
                        {user.phone && <p className="text-xs text-slate-400">{user.phone}</p>}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{user.role.name}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {user.department_ids.length === 0 && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {user.department_ids.map((id) => (
                            <Badge key={id} tone="neutral">
                              {departmentNameById.get(id) ?? "Unknown"}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Can permission="user.manage">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              className="gap-1.5 px-2 py-1 text-xs"
                              onClick={() => setEditingUserId(user.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </Button>
                            <Can permission="department.manage">
                              <Button
                                variant="ghost"
                                className="gap-1.5 px-2 py-1 text-xs"
                                onClick={() => setManagingDepartmentsUserId(user.id)}
                              >
                                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Departments
                              </Button>
                            </Can>
                            <Can permission="course.access.manage">
                              <Button
                                variant="ghost"
                                className="gap-1.5 px-2 py-1 text-xs"
                                onClick={() => setManagingTrainingAccessUserId(user.id)}
                              >
                                <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                                Training Access
                              </Button>
                            </Can>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={
                                toggleActive.isPending && toggleActive.variables?.id === user.id
                              }
                              onClick={() => toggleActive.mutate(user)}
                            >
                              {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>
      </Card>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        availableRoles={availableRoles}
        onSuccess={() => setCreateOpen(false)}
      />
      {editingUser && (
        <EditUserModal
          open={!!editingUserId}
          onClose={() => setEditingUserId(null)}
          user={editingUser}
          availableRoles={availableRoles}
          onSuccess={() => setEditingUserId(null)}
        />
      )}
      {managingDepartmentsUser && (
        <ManageUserDepartmentsModal
          open={!!managingDepartmentsUserId}
          onClose={() => setManagingDepartmentsUserId(null)}
          user={managingDepartmentsUser}
        />
      )}
      {managingTrainingAccessUser && (
        <UserTrainingAccessModal
          open={!!managingTrainingAccessUserId}
          onClose={() => setManagingTrainingAccessUserId(null)}
          user={managingTrainingAccessUser}
        />
      )}
    </div>
  );
}
