import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import type { AdminUserResponse, CourseAccessResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { SelectField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listCourses } from "../../../services/api/courses";
import {
  listUserCourseAccess,
  grantUserCourseAccess,
  revokeUserCourseAccess,
} from "../../../services/api/courseAccess";

/**
 * Training Access assignment inside User Management unit — reuses the
 * existing `course_access` grant/revoke/list API exactly as-is (see
 * services/api/courseAccess.ts's `listUserCourseAccess`/
 * `grantUserCourseAccess`/`revokeUserCourseAccess`, themselves thin
 * user-addressed wrappers around the same endpoints/service functions
 * course-access.routes.ts already exposes). Combines
 * GrantAccessModal.tsx's grant picker and CourseAccessPanel.tsx's
 * audit-history table into one modal, mirroring the exact pattern already
 * established for Resources/Announcements access
 * (ResourceAccessModal.tsx/AnnouncementAccessModal.tsx) — Users, like
 * those, has no per-item admin detail page, so a modal reached from the
 * list row is the smallest addition, not a new page/route.
 *
 * Course names are resolved via a plain `listCourses` fetch (up to 100,
 * same limitation already accepted for user names in CourseAccessPanel.tsx
 * — there is no "look up courses by id" endpoint) rather than a text-search
 * box: unlike users, there is no existing "search courses" endpoint to
 * reuse, and adding one is out of scope for this unit ("no schema/API
 * change unless inspection proves otherwise") — a plain dropdown over the
 * existing admin course list is sufficient for "grant a course".
 *
 * This only ever reads/writes `course_access` — department membership
 * (`user_departments`, managed by ManageUserDepartmentsModal.tsx) is a
 * completely separate mechanism, untouched here.
 */
export function UserTrainingAccessModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUserResponse;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<CourseAccessResponse | null>(null);

  const accessQuery = useQuery({
    queryKey: ["user-course-access", user.id],
    queryFn: () => listUserCourseAccess(user.id),
    enabled: open,
  });
  const coursesQuery = useQuery({
    queryKey: ["admin-courses-for-access-picker"],
    queryFn: () => listCourses({ pageSize: 100 }),
    enabled: open,
  });

  const courseTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of coursesQuery.data?.data ?? []) {
      map.set(course.id, course.title);
    }
    return map;
  }, [coursesQuery.data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["user-course-access", user.id] });

  const grant = useMutation({
    mutationFn: (courseId: string) => grantUserCourseAccess(user.id, courseId),
    onSuccess: () => {
      invalidate();
      setSelectedCourseId("");
      toast.success("Access granted.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to grant access.");
    },
  });
  const revoke = useMutation({
    mutationFn: (courseId: string) => revokeUserCourseAccess(user.id, courseId),
    onSuccess: () => {
      invalidate();
      toast.success("Access revoked.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to revoke access.");
    },
  });

  const activeCourseIds = new Set(
    (accessQuery.data ?? []).filter((row) => row.is_active).map((row) => row.course_id),
  );
  const grantableCourses = (coursesQuery.data?.data ?? []).filter(
    (course) => !activeCourseIds.has(course.id),
  );

  return (
    <Modal open={open} onClose={onClose} title={`Training Access — ${user.full_name}`} wide>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Grant Course Access</h3>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <SelectField
              label="Course"
              id="grant-course-select"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              disabled={coursesQuery.isLoading}
            >
              <option value="">Select a course…</option>
              {grantableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </SelectField>
          </div>
          <Button
            type="button"
            className="gap-1.5"
            disabled={!selectedCourseId || grant.isPending}
            onClick={() => grant.mutate(selectedCourseId)}
          >
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            {grant.isPending ? "Granting…" : "Grant"}
          </Button>
        </div>

      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Explicit Course Access</h3>
        <p className="mt-1 text-xs text-slate-500">
          Courses granted to this user directly, independent of department membership.
        </p>

        <div className="mt-3 overflow-x-auto">
          <RemoteDataView
            isLoading={accessQuery.isLoading}
            isError={accessQuery.isError}
            error={accessQuery.error}
            data={accessQuery.data}
            onRetry={() => void accessQuery.refetch()}
            isEmpty={(items) => items.length === 0}
            emptyTitle="No explicit course access grants"
            emptyDescription="Grant this user access to a specific course, independent of their department."
          >
            {(rows) => (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Granted</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {courseTitleById.get(row.course_id) ?? row.course_id}
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
                            disabled={grant.isPending && grant.variables === row.course_id}
                            onClick={() => grant.mutate(row.course_id)}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
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
        title="Revoke course access"
        description="This user will lose direct access to this course. Department-based access, if any, is unaffected. You can restore it later."
        confirmLabel="Revoke"
        isPending={revoke.isPending}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revoke.mutate(revokeTarget.course_id);
          setRevokeTarget(null);
        }}
      />
    </Modal>
  );
}
