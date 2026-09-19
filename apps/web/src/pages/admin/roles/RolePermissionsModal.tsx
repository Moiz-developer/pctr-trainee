import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { CheckboxField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listAllPermissions, setRolePermissions } from "../../../services/api/roles";

/**
 * Assign/remove a role's permissions (Admin Role & Permission Management).
 * Mirrors CourseDepartmentsPanel.tsx's exact shape — a checkbox grid over
 * the complete catalogue plus a single "Save" that replaces the whole set
 * (`PUT .../permissions`), not per-checkbox immediate calls. Selection is
 * derived from the role's own `permission_ids` during render
 * (`pendingSelection` stays `null` until touched) rather than synced via an
 * effect, the same pattern used throughout this codebase to avoid
 * react-hooks/set-state-in-effect.
 */
export function RolePermissionsModal({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: RoleResponse;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  const allPermissions = useQuery({
    queryKey: ["all-permissions"],
    queryFn: listAllPermissions,
    enabled: open,
  });

  const assignedIds = useMemo(() => new Set(role.permission_ids), [role.permission_ids]);
  const selected = pendingSelection ?? assignedIds;
  const dirty = pendingSelection !== null;

  const mutation = useMutation({
    mutationFn: () => setRolePermissions(role.id, { permission_ids: [...selected] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setPendingSelection(null);
      toast.success("Permissions saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save.");
    },
  });

  function toggle(permissionId: string) {
    const next = new Set(selected);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    setPendingSelection(next);
  }

  function handleClose() {
    setPendingSelection(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Permissions — ${role.name}`} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Every permission this role grants to any user holding it.
          </p>
          <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>

        <RemoteDataView
          isLoading={allPermissions.isLoading}
          isError={allPermissions.isError}
          error={allPermissions.error}
          data={allPermissions.data}
          onRetry={() => void allPermissions.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No permissions exist"
        >
          {(permissions) => (
            <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {permissions.map((permission) => (
                <CheckboxField
                  key={permission.id}
                  id={`perm-${permission.id}`}
                  label={permission.code}
                  checked={selected.has(permission.id)}
                  onChange={() => toggle(permission.id)}
                />
              ))}
            </div>
          )}
        </RemoteDataView>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
