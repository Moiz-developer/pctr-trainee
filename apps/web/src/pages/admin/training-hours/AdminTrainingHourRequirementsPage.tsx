import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Clock3 } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listTrainingHourRequirements } from "../../../services/api/trainingHourRequirements";
import { TrainingHourRequirementFormModal } from "./TrainingHourRequirementFormModal";

/**
 * Admin config for `training_hour_requirements` (SYSTEM_PLAN.md §14.3) — the
 * "hours allocated" side of the dashboard's hours-consumed-vs-allocated
 * figure. List + create only, newest `effective_from` first — no
 * update/delete: a requirement is "changed" by adding a new row with a
 * later `effective_from` (see the shared schema's doc comment). A trainee's
 * resolved requirement (most recent USER-scope row if any, else the highest
 * per-department row) is computed by training-hours.service.ts, not shown
 * per-row here.
 */
export function AdminTrainingHourRequirementsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ["admin-training-hour-requirements"],
    queryFn: () => listTrainingHourRequirements({ pageSize: 50 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Training Hour Requirements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure required training hours per department or individual user.
          </p>
        </div>
        <Can permission="training.manage">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Requirement
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
          emptyTitle="No training hour requirements yet"
          emptyDescription="Create one to set how many hours are required for a department or a specific user."
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Scope</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2 pr-4">Required Hours</th>
                    <th className="py-2 pr-4">Effective From</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4">
                        <Badge tone={row.scope === "DEPARTMENT" ? "info" : "neutral"}>
                          {row.scope === "DEPARTMENT" ? "Department" : "User"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {row.department_name ?? row.user_full_name ?? "—"}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{row.required_hours}h</td>
                      <td className="py-3 pr-4 text-slate-500">{row.effective_from}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RemoteDataView>
      </Card>

      <TrainingHourRequirementFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
    </div>
  );
}
