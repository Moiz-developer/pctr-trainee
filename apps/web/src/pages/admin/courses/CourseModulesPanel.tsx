import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, Pencil, Plus } from "lucide-react";
import type { CourseModuleResponse } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { MediaImage } from "../../../components/shared/MediaImage";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { listCourseModules, updateCourseModule } from "../../../services/api/courseModules";
import { ModuleFormModal } from "./ModuleFormModal";
import { LessonsPanel } from "./LessonsPanel";
import { ReorderControls, RowIconButton } from "./ContentRowControls";

/**
 * SYSTEM_PLAN.md §17: modules use `is_active` to retire content (no delete
 * endpoint exists — Unit 2.3 deliberately doesn't have one). Reordering
 * swaps `sort_order` with the adjacent module via two PATCH calls rather
 * than exposing a raw number field to type into.
 */
export function CourseModulesPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
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

  const onMutationError = (error: unknown) => {
    toast.error(error instanceof ApiClientError ? error.message : "Something went wrong.");
  };

  const toggleActive = useMutation({
    mutationFn: (module: CourseModuleResponse) =>
      updateCourseModule(courseId, module.id, { is_active: !module.is_active }),
    onSuccess: (_data, module) => {
      invalidate();
      toast.success(module.is_active ? "Module retired." : "Module reactivated.");
    },
    onError: onMutationError,
  });

  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: CourseModuleResponse; b: CourseModuleResponse }) =>
      Promise.all([
        updateCourseModule(courseId, a.id, { sort_order: b.sort_order }),
        updateCourseModule(courseId, b.id, { sort_order: a.sort_order }),
      ]),
    onSuccess: invalidate,
    onError: onMutationError,
  });

  function move(modules: CourseModuleResponse[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    reorder.mutate({ a: modules[index]!, b: modules[target]! });
  }

  const moduleCount = query.data?.length;

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-indigo-950">
            Modules &amp; Lessons
            {moduleCount !== undefined && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900">
                {moduleCount} {moduleCount === 1 ? "module" : "modules"}
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Expand a module to manage its lessons. Use the arrows to change the order trainees see.
          </p>
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
          <ul className="space-y-3">
            {modules.map((module, index) => {
              const isOpen = expanded === module.id;
              return (
                <li
                  key={module.id}
                  className={`overflow-hidden rounded-lg border bg-white transition-shadow ${
                    isOpen
                      ? "border-indigo-300 shadow-[0_2px_8px_rgba(49,44,133,0.10)]"
                      : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3 sm:px-4 ${
                      isOpen ? "bg-indigo-50/60" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 basis-64 cursor-pointer items-center gap-3 text-left"
                      onClick={() => setExpanded(isOpen ? null : module.id)}
                      aria-expanded={isOpen}
                      aria-controls={`module-lessons-${module.id}`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                          isOpen ? "bg-indigo-900 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                        aria-hidden="true"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      {module.image_media_id && (
                        <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-slate-100">
                          <MediaImage
                            mediaAssetId={module.image_media_id}
                            className="h-full w-full object-cover"
                            fallback={null}
                          />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Folder className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                          <span className="text-xs font-semibold text-slate-400">
                            Module {index + 1}
                          </span>
                          <span
                            className={`truncate text-sm font-semibold ${
                              module.is_active ? "text-indigo-950" : "text-slate-500"
                            }`}
                          >
                            {module.title}
                          </span>
                          <Badge tone={module.is_active ? "success" : "neutral"}>
                            {module.is_active ? "Active" : "Retired"}
                          </Badge>
                        </span>
                        {module.description && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {module.description}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <ReorderControls
                        canMoveUp={index > 0}
                        canMoveDown={index < modules.length - 1}
                        disabled={reorder.isPending}
                        onMoveUp={() => move(modules, index, -1)}
                        onMoveDown={() => move(modules, index, 1)}
                      />
                      <RowIconButton
                        icon={Pencil}
                        label="Edit module"
                        onClick={() => setFormState({ open: true, module })}
                      />
                      <Button
                        type="button"
                        variant={module.is_active ? "secondary" : "primary"}
                        className="px-3 py-1.5 text-xs"
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
