import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, ShieldCheck } from "lucide-react";
import type { RoleResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listRoles } from "../../../services/api/roles";
import { RoleFormModal } from "./RoleFormModal";
import { RolePermissionsModal } from "./RolePermissionsModal";

/**
 * Admin Role & Permission Management (SYSTEM_PLAN.md §5/§10, permission
 * `role.manage`). Mirrors AdminResourceCategoriesPage.tsx/
 * AdminQueryCategoriesPage.tsx's exact list+create-modal shape — the same
 * admin-managed-lookup-table pattern, applied to `roles`. Permission
 * assignment is a separate modal (`RolePermissionsModal`), the same
 * separate-concern split as Course Access vs CourseFormModal and User
 * Departments vs EditUserModal.
 */
export function AdminRolesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleResponse | null>(null);
  const [managingPermissions, setManagingPermissions] = useState<RoleResponse | null>(null);

  const query = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => listRoles(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage roles and which permissions each one grants.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Role
        </Button>
      </div>

      <Card>
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No roles yet"
          emptyDescription="Create a role so it can be assigned to users."
        >
          {(roles) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Permissions</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {role.name}
                          {role.is_system && <Badge tone="info">System</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{role.code}</td>
                      <td className="py-3 pr-4 text-slate-600">{role.description ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {role.permission_ids.length}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            className="gap-1.5 px-2 py-1 text-xs"
                            onClick={() => setEditing(role)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            className="gap-1.5 px-2 py-1 text-xs"
                            onClick={() => setManagingPermissions(role)}
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            Permissions
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>
      </Card>

      <RoleFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      {editing && (
        <RoleFormModal
          open={!!editing}
          onClose={() => setEditing(null)}
          role={editing}
          onSuccess={() => setEditing(null)}
        />
      )}
      {managingPermissions && (
        <RolePermissionsModal
          open={!!managingPermissions}
          onClose={() => setManagingPermissions(null)}
          role={managingPermissions}
        />
      )}
    </div>
  );
}
