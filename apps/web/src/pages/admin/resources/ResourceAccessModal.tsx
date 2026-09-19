import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import type { ResourceAccessResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { searchUsers } from "../../../services/api/users";
import {
  listResourceAccess,
  grantResourceAccess,
  revokeResourceAccess,
} from "../../../services/api/resourceAccess";

/**
 * Explicit per-user Resource access (consistent granular access control
 * unit, §1/§5). Combines CourseAccessPanel.tsx's audit-history table and
 * GrantAccessModal.tsx's dynamic user-search-and-grant picker into one
 * modal, reached from a list row's "Access" button — Resources has no
 * per-item admin detail page (unlike Courses' /admin/courses/:id), so a
 * modal mirrors ManageUserDepartmentsModal.tsx's precedent of "a dedicated
 * modal reached directly from the flat list row" rather than adding a new
 * detail route just for this.
 */
export function ResourceAccessModal({
  open,
  onClose,
  resourceId,
  resourceTitle,
}: {
  open: boolean;
  onClose: () => void;
  resourceId: string;
  resourceTitle: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [submittedTerm, setSubmittedTerm] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ResourceAccessResponse | null>(null);

  const accessQuery = useQuery({
    queryKey: ["resource-access", resourceId],
    queryFn: () => listResourceAccess(resourceId),
    enabled: open,
  });
  const searchQuery = useQuery({
    queryKey: ["user-search", submittedTerm],
    queryFn: () => searchUsers(submittedTerm),
    enabled: open,
  });
  // Resolves user_id -> name for the grants table below (mirrors
  // CourseAccessPanel.tsx: there is no "look up users by id" endpoint, so
  // this is built from up to 100 users, same >100-user limitation).
  const allUsersQuery = useQuery({
    queryKey: ["user-search", ""],
    queryFn: () => searchUsers(""),
    enabled: open,
  });
  const userMap = useMemo(() => {
    const map = new Map<string, { full_name: string; employee_id: string }>();
    for (const user of allUsersQuery.data ?? []) {
      map.set(user.id, { full_name: user.full_name, employee_id: user.employee_id });
    }
    return map;
  }, [allUsersQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["resource-access", resourceId] });

  const grant = useMutation({
    mutationFn: (userId: string) => grantResourceAccess(resourceId, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Access granted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to grant access.");
    },
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeResourceAccess(resourceId, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Access revoked.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to revoke access.");
    },
  });

  const activeUserIds = useMemo(
    () => new Set((accessQuery.data ?? []).filter((row) => row.is_active).map((row) => row.user_id)),
    [accessQuery.data],
  );

  return (
    <Modal open={open} onClose={onClose} title={`Access — ${resourceTitle}`} wide>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Grant Access</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedTerm(term);
          }}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search by name, employee ID, or email…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {submittedTerm && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-100">
            <RemoteDataView
              isLoading={searchQuery.isLoading}
              isError={searchQuery.isError}
              error={searchQuery.error}
              data={searchQuery.data}
              isEmpty={(items) => items.length === 0}
              emptyTitle="No matching users"
            >
              {(users) => (
                <ul className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const alreadyGranted = activeUserIds.has(user.id);
                    return (
                      <li key={user.id} className="flex items-center justify-between gap-3 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {user.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {user.employee_id} · {user.email}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="shrink-0 gap-1 px-3 py-1.5 text-xs"
                          disabled={alreadyGranted || (grant.isPending && grant.variables === user.id)}
                          onClick={() => grant.mutate(user.id)}
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          {alreadyGranted ? "Already granted" : "Grant"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RemoteDataView>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Explicit User Access</h3>
        <p className="mt-1 text-xs text-slate-500">
          Grants access to a specific user regardless of department.
        </p>

        <div className="mt-3 overflow-x-auto">
          <RemoteDataView
            isLoading={accessQuery.isLoading}
            isError={accessQuery.isError}
            error={accessQuery.error}
            data={accessQuery.data}
            onRetry={() => void accessQuery.refetch()}
            isEmpty={(items) => items.length === 0}
            emptyTitle="No explicit access grants"
          >
            {(rows) => (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Granted</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const user = userMap.get(row.user_id);
                    return (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-900">{user?.full_name ?? row.user_id}</p>
                        {user && <p className="text-xs text-slate-500">{user.employee_id}</p>}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={row.is_active ? "success" : "neutral"}>
                          {row.is_active ? "Active" : "Revoked"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {new Date(row.granted_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {row.is_active ? (
                          <Button
                            type="button"
                            variant="destructive"
                            className="px-2 py-1 text-xs"
                            onClick={() => setRevokeTarget(row)}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={revoke.isPending}
                            onClick={() => grant.mutate(row.user_id)}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </RemoteDataView>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke access"
        description="This user will lose access to this resource. You can restore it later."
        confirmLabel="Revoke"
        isPending={revoke.isPending}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revoke.mutate(revokeTarget.user_id);
          setRevokeTarget(null);
        }}
      />
    </Modal>
  );
}
