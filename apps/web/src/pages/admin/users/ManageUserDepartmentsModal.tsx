import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUserResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ApiClientError } from "../../../services/api/client";
import { listDepartments } from "../../../services/api/departments";
import { assignUserDepartment, removeUserDepartment } from "../../../services/api/users";

/**
 * Add/remove a user's department memberships (Admin Users + Departments UI
 * unit) — a separate modal from EditUserModal, mirroring how Course Access
 * is its own concern separate from CourseFormModal. Each row fires its own
 * assign/remove call immediately (no batched "Save"): the backend has no
 * whole-set-replace endpoint for user_departments (unlike course_departments'
 * PUT), only add (`POST .../departments`) and remove
 * (`DELETE .../departments/:departmentId`, added by this unit) — see this
 * unit's implementation report for why a batch-replace endpoint wasn't
 * added (not a proven blocker; add/remove alone fully covers "manage
 * assignment", matching SYSTEM_PLAN.md §6's many-department-per-user model).
 *
 * `user` is looked up fresh by the parent on every render (by id, from its
 * own live query), not a stale snapshot — so this modal reflects the
 * latest department_ids immediately after each mutation invalidates the
 * shared `admin-users` query.
 */
export function ManageUserDepartmentsModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUserResponse;
}) {
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => listDepartments(),
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: (departmentId: string) =>
      assignUserDepartment(user.id, { department_id: departmentId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const remove = useMutation({
    mutationFn: (departmentId: string) => removeUserDepartment(user.id, departmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const pendingError = assign.error ?? remove.error;

  return (
    <Modal open={open} onClose={onClose} title={`Departments — ${user.full_name}`}>
      {pendingError && (
        <p className="mb-3 text-sm text-red-600">
          {pendingError instanceof ApiClientError ? pendingError.message : "Something went wrong."}
        </p>
      )}

      <RemoteDataView
        isLoading={departmentsQuery.isLoading}
        isError={departmentsQuery.isError}
        error={departmentsQuery.error}
        data={departmentsQuery.data?.data}
        onRetry={() => void departmentsQuery.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No departments exist yet"
      >
        {(departments) => (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {departments.map((department) => {
              const isAssigned = user.department_ids.includes(department.id);
              const isPending =
                (assign.isPending && assign.variables === department.id) ||
                (remove.isPending && remove.variables === department.id);
              return (
                <li key={department.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{department.name}</p>
                    {!department.is_active && (
                      <p className="text-xs text-slate-400">Inactive department</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={isAssigned ? "destructive" : "secondary"}
                    className="shrink-0 px-3 py-1.5 text-xs"
                    disabled={isPending || (!isAssigned && !department.is_active)}
                    onClick={() =>
                      isAssigned ? remove.mutate(department.id) : assign.mutate(department.id)
                    }
                  >
                    {isAssigned ? "Remove" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </RemoteDataView>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
