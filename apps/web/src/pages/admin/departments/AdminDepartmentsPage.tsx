import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus } from "lucide-react";
import type { DepartmentResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listDepartments, updateDepartment } from "../../../services/api/departments";
import { DepartmentFormModal } from "./DepartmentFormModal";

/**
 * Admin Departments management (Admin Users + Departments UI unit): closes
 * the Phase 1 gap identified by the Phase 2J audit — the backend
 * (departments.routes.ts, `department.manage`) already fully supported
 * create/list/update/activate-deactivate; only this page was missing.
 * Mirrors CourseCategoriesPage.tsx's list+create-modal shape exactly (same
 * admin-managed-lookup-table pattern).
 */
export function AdminDepartmentsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentResponse | null>(null);

  const query = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => listDepartments(),
  });

  const toggleActive = useMutation({
    mutationFn: (target: DepartmentResponse) =>
      updateDepartment(target.id, { is_active: !target.is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Departments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the departments trainees and courses are organized under.
          </p>
        </div>
        <Can permission="department.manage">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Department
          </Button>
        </Can>
      </div>

      <Card>
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data?.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No departments yet"
          emptyDescription="Create a department so users and courses can be assigned to it."
        >
          {(departments) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {department.name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{department.slug}</td>
                      <td className="py-3 pr-4 text-slate-600">{department.description ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={department.is_active ? "success" : "neutral"}>
                          {department.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Can permission="department.manage">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              className="gap-1.5 px-2 py-1 text-xs"
                              onClick={() => setEditing(department)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={
                                toggleActive.isPending &&
                                toggleActive.variables?.id === department.id
                              }
                              onClick={() => toggleActive.mutate(department)}
                            >
                              {department.is_active ? "Deactivate" : "Activate"}
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

      <DepartmentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <DepartmentFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        department={editing ?? undefined}
        onSuccess={() => setEditing(null)}
      />
    </div>
  );
}
