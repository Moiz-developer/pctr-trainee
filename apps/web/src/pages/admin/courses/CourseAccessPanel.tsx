import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import type { CourseAccessResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import {
  listCourseAccess,
  revokeCourseAccess,
  grantCourseAccess,
} from "../../../services/api/courseAccess";
import { searchUsers } from "../../../services/api/users";
import { GrantAccessModal } from "./GrantAccessModal";

/**
 * Explicit per-user course access (SYSTEM_PLAN.md §6/§26, Unit 2.5's
 * grant/revoke/list API — reused as-is, no second access resolver). Lists
 * both active and revoked grants (an audit-style history, per Unit 2.5),
 * with Revoke/Restore actions; "restore" reuses the same grant endpoint,
 * which reactivates a revoked row rather than creating a duplicate.
 *
 * User names are resolved via a client-side id -> user map built from up to
 * 100 users (services/api/users.ts) since there is no "look up users by
 * id" endpoint — see this unit's implementation report for the >100-user
 * limitation this implies.
 */
export function CourseAccessPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CourseAccessResponse | null>(null);

  const accessQuery = useQuery({
    queryKey: ["course-access", courseId],
    queryFn: () => listCourseAccess(courseId),
  });
  const usersQuery = useQuery({ queryKey: ["user-search", ""], queryFn: () => searchUsers("") });

  const userMap = useMemo(() => {
    const map = new Map<string, { full_name: string; employee_id: string }>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, { full_name: user.full_name, employee_id: user.employee_id });
    }
    return map;
  }, [usersQuery.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["course-access", courseId] });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeCourseAccess(courseId, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Access revoked.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to revoke access.");
    },
  });
  const restore = useMutation({
    mutationFn: (userId: string) => grantCourseAccess(courseId, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Access restored.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to restore access.");
    },
  });

  const activeUserIds = new Set(
    (accessQuery.data ?? []).filter((row) => row.is_active).map((row) => row.user_id),
  );

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Explicit User Access</h3>
          <p className="mt-1 text-xs text-slate-500">
            Grants access to a specific user regardless of department.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={() => setGrantOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Grant Access
        </Button>
      </div>

      <RemoteDataView
        isLoading={accessQuery.isLoading}
        isError={accessQuery.isError}
        error={accessQuery.error}
        data={accessQuery.data}
        onRetry={() => void accessQuery.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No explicit access grants"
        emptyDescription="Grant a specific user access, independent of their department."
      >
        {(rows) => (
          <div className="overflow-x-auto">
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
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900">
                          {user?.full_name ?? row.user_id}
                        </p>
                        {user && <p className="text-xs text-slate-500">{user.employee_id}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={row.is_active ? "success" : "neutral"}>
                          {row.is_active ? "Active" : "Revoked"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {new Date(row.granted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-right">
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
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(row.user_id)}
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
          </div>
        )}
      </RemoteDataView>

      <GrantAccessModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        courseId={courseId}
        alreadyGrantedUserIds={activeUserIds}
      />
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke access"
        description={`This user will lose access to this course. You can restore it later.`}
        confirmLabel="Revoke"
        isPending={revoke.isPending}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revoke.mutate(revokeTarget.user_id);
          setRevokeTarget(null);
        }}
      />
    </Card>
  );
}
