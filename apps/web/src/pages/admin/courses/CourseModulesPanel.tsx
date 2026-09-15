import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Folder, Pencil, Plus } from "lucide-react";
import type { CourseModuleResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { listCourseModules, updateCourseModule } from "../../../services/api/courseModules";
import { ModuleFormModal } from "./ModuleFormModal";
import { LessonsPanel } from "./LessonsPanel";

/**
 * SYSTEM_PLAN.md §17: modules use `is_active` to retire content (no delete
 * endpoint exists — Unit 2.3 deliberately doesn't have one). Reordering
 * swaps `sort_order` with the adjacent module via two PATCH calls rather
 * than exposing a raw number field to type into.
 */
export function CourseModulesPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ open: boolean; module?: CourseModuleResponse }>({
    open: false,
  });
  const [retireTarget, setRetireTarget] = useState<CourseModuleResponse | null>(null);

  const query = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: () => listCourseModules(courseId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });

  const toggleActive = useMutation({
    mutationFn: (module: CourseModuleResponse) =>
      updateCourseModule(courseId, module.id, { is_active: !module.is_active }),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: CourseModuleResponse; b: CourseModuleResponse }) =>
      Promise.all([
        updateCourseModule(courseId, a.id, { sort_order: b.sort_order }),
        updateCourseModule(courseId, b.id, { sort_order: a.sort_order }),
      ]),
    onSuccess: invalidate,
  });

  function move(modules: CourseModuleResponse[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    reorder.mutate({ a: modules[index]!, b: modules[target]! });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Modules & Lessons</h3>
          <p className="mt-1 text-xs text-slate-500">Expand a module to manage its lessons.</p>
        </div>
        <Button type="button" className="gap-2" onClick={() => setFormState({ open: true })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Module
        </Button>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(items) => items.length === 0}
        emptyTitle="No modules yet"
        emptyDescription="Create the first module to start building this course's content."
      >
        {(modules) => (
          <ul className="space-y-2">
            {modules.map((module, index) => {
              const isOpen = expanded === module.id;
              return (
                <li key={module.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                      onClick={() => setExpanded(isOpen ? null : module.id)}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <Folder className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {module.title}
                      </span>
                      <Badge tone={module.is_active ? "success" : "neutral"}>
                        {module.is_active ? "Active" : "Retired"}
                      </Badge>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                        disabled={index === 0 || reorder.isPending}
                        onClick={() => move(modules, index, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                        disabled={index === modules.length - 1 || reorder.isPending}
                        onClick={() => move(modules, index, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={() => setFormState({ open: true, module })}
                        aria-label="Edit module"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <Button
                        type="button"
                        variant={module.is_active ? "secondary" : "primary"}
                        className="px-2 py-1 text-xs"
                        onClick={() =>
                          module.is_active ? setRetireTarget(module) : toggleActive.mutate(module)
                        }
                      >
                        {module.is_active ? "Retire" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                  {isOpen && <LessonsPanel courseId={courseId} moduleId={module.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </RemoteDataView>

      <ModuleFormModal
        open={formState.open}
        onClose={() => setFormState({ open: false })}
        courseId={courseId}
        module={formState.module}
        nextSortOrder={(query.data?.length ?? 0) + 1}
      />
      <ConfirmDialog
        open={!!retireTarget}
        title="Retire module"
        description={`"${retireTarget?.title}" and its lessons will be hidden from trainees but the record is kept (never deleted). You can reactivate it later.`}
        confirmLabel="Retire"
        isPending={toggleActive.isPending}
        onCancel={() => setRetireTarget(null)}
        onConfirm={() => {
          if (retireTarget) toggleActive.mutate(retireTarget);
          setRetireTarget(null);
        }}
      />
    </Card>
  );
}
