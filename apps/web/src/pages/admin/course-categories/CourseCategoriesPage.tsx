import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Tags } from "lucide-react";
import type { CourseCategoryResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { Can } from "../../../authorization/Can";
import { listCourseCategories, updateCourseCategory } from "../../../services/api/courseCategories";
import { listAllDepartments } from "../../../services/api/departments";
import { CourseCategoryFormModal } from "./CourseCategoryFormModal";

/**
 * Admin Training Categories management (Admin Navigation + Dynamic Course
 * Categories unit): create/list/update/activate-deactivate, mirroring
 * AdminCoursesListPage.tsx's list+create-modal shape. Deactivating a
 * category here immediately makes it unselectable in CourseFormModal.tsx's
 * dropdown (validated server-side too — courses.service.ts) without
 * affecting any course that already references it (ON DELETE SET NULL).
 *
 * Department -> Category -> Training Content hierarchy unit: the Department
 * column makes the "Category belongs to a Department" half of the
 * hierarchy visible here; each course's own row (AdminCoursesListPage.tsx)
 * already shows that course's category, so the two pages together make the
 * full Department -> Category -> Course chain browsable without a new,
 * dedicated hierarchy screen.
 */
export function CourseCategoriesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CourseCategoryResponse | null>(null);

  const query = useQuery({
    queryKey: ["admin-course-categories"],
    queryFn: () => listCourseCategories(),
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
    mutationFn: (target: CourseCategoryResponse) =>
      updateCourseCategory(target.id, { is_active: !target.is_active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-course-categories"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Training Categories</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the categories available when creating or editing courses.
          </p>
        </div>
        <Can permission="course.create">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Category
          </Button>
        </Can>
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
          emptyDescription="Create a category so it can be selected when authoring courses."
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
                        <Can permission="course.create">
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

      <CourseCategoryFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <CourseCategoryFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        category={editing ?? undefined}
        onSuccess={() => setEditing(null)}
      />
    </div>
  );
}
