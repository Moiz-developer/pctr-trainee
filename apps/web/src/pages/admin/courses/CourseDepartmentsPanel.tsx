import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { CheckboxField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listAllDepartments } from "../../../services/api/departments";
import {
  getCourseDepartments,
  setCourseDepartments,
} from "../../../services/api/courseDepartments";

/**
 * "Assign the course to departments" (this unit's scope §1/§5) — a
 * department-assignment set has no history to preserve (unlike
 * course_access), so a straightforward multi-select + Save replacing the
 * whole set matches the underlying API (`PUT .../departments`).
 *
 * Selection state is derived from the server data during render rather than
 * synced via an effect (`pendingSelection` is `null` until the admin makes a
 * change, and reset to `null` again on save so it then tracks fresh server
 * data) — avoids the cascading-render setState-in-effect issue entirely.
 */
export function CourseDepartmentsPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  const allDepartments = useQuery({
    queryKey: ["all-departments"],
    queryFn: listAllDepartments,
  });
  const assigned = useQuery({
    queryKey: ["course-departments", courseId],
    queryFn: () => getCourseDepartments(courseId),
  });

  const assignedIds = useMemo(
    () => new Set((assigned.data ?? []).map((department) => department.id)),
    [assigned.data],
  );
  const selected = pendingSelection ?? assignedIds;
  const dirty = pendingSelection !== null;

  const mutation = useMutation({
    mutationFn: () => setCourseDepartments(courseId, [...selected]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-departments", courseId] });
      setPendingSelection(null);
      toast.success("Department assignments saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save.");
    },
  });

  function toggle(departmentId: string) {
    const next = new Set(selected);
    if (next.has(departmentId)) next.delete(departmentId);
    else next.add(departmentId);
    setPendingSelection(next);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Department Access</h3>
          <p className="mt-1 text-xs text-slate-500">
            Users in any of these departments will have access to this course.
          </p>
        </div>
        <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="mt-4">
        <RemoteDataView
          isLoading={allDepartments.isLoading || assigned.isLoading}
          isError={allDepartments.isError || assigned.isError}
          error={allDepartments.error ?? assigned.error}
          data={allDepartments.data}
          onRetry={() => {
            void allDepartments.refetch();
            void assigned.refetch();
          }}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No departments exist yet"
          emptyDescription="Create a department first, then assign this course to it."
        >
          {(departments) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <CheckboxField
                  key={department.id}
                  id={`dept-${department.id}`}
                  label={department.name}
                  checked={selected.has(department.id)}
                  onChange={() => toggle(department.id)}
                />
              ))}
            </div>
          )}
        </RemoteDataView>
      </div>
    </Card>
  );
}
