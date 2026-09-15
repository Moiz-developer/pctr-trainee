import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Tags } from "lucide-react";
import type { QueryCategoryResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { listQueryCategories, updateQueryCategory } from "../../../services/api/queryCategories";
import { listAllDepartments } from "../../../services/api/departments";
import { QueryCategoryFormModal } from "./QueryCategoryFormModal";

/**
 * Admin Query Category management (Query Category dropdown unit, permission
 * `query.manage`). Mirrors AdminResourceCategoriesPage.tsx exactly. Reached
 * from AdminQueriesPage.tsx's "Manage Categories" button rather than its own
 * sidebar entry — same reasoning as Resources' identical choice.
 *
 * Department -> Category -> Training Content hierarchy unit: the Department
 * column mirrors CourseCategoriesPage.tsx/AdminResourceCategoriesPage.tsx's
 * identical addition.
 */
export function AdminQueryCategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<QueryCategoryResponse | null>(null);

  const query = useQuery({
    queryKey: ["admin-query-category-records"],
    queryFn: () => listQueryCategories(),
  });

  const departmentsQuery = useQuery({
    queryKey: ["all-departments"],
    queryFn: listAllDepartments,
  });
  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsQuery.data ?? []) {
      map.set(department.id, department.name);
    }
    return map;
  }, [departmentsQuery.data]);

  const toggleActive = useMutation({
    mutationFn: (target: QueryCategoryResponse) =>
      updateQueryCategory(target.id, { is_active: !target.is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-query-category-records"] });
    },
  });

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void navigate("/admin/queries")}
        className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Queries
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Query Categories</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the categories trainers can select when submitting a query.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Category
        </Button>
      </div>

      <Card>
        <RemoteDataView
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          onRetry={() => void query.refetch()}
          isEmpty={(items) => items.length === 0}
          emptyTitle="No categories yet"
          emptyDescription="Create a category so it can be selected when submitting a query."
        >
          {(categories) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Tags className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          {category.name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{category.slug}</td>
                      <td className="py-3 pr-4 text-slate-600">{category.description ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={category.department_id ? "info" : "neutral"}>
                          {category.department_id
                            ? (departmentNameById.get(category.department_id) ?? "Unknown")
                            : "Global"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={category.is_active ? "success" : "neutral"}>
                          {category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            className="gap-1.5 px-2 py-1 text-xs"
                            onClick={() => setEditing(category)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={
                              toggleActive.isPending && toggleActive.variables?.id === category.id
                            }
                            onClick={() => toggleActive.mutate(category)}
                          >
                            {category.is_active ? "Deactivate" : "Activate"}
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

      <QueryCategoryFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <QueryCategoryFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        category={editing ?? undefined}
        onSuccess={() => setEditing(null)}
      />
    </div>
  );
}
