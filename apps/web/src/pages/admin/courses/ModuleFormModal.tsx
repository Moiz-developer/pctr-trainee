import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CourseModuleResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createCourseModule, updateCourseModule } from "../../../services/api/courseModules";

interface ModuleFormValues {
  title: string;
  description: string;
}

/**
 * `sort_order` is deliberately not a form field — new modules are appended
 * (nextSortOrder), and reordering existing ones happens via the up/down
 * controls in CourseModulesPanel, not by hand-typing a number here.
 */
export function ModuleFormModal({
  open,
  onClose,
  courseId,
  module,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  module?: CourseModuleResponse;
  nextSortOrder: number;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!module;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ModuleFormValues>({ defaultValues: { title: "", description: "" } });

  useEffect(() => {
    if (!open) return;
    reset({ title: module?.title ?? "", description: module?.description ?? "" });
  }, [open, module, reset]);

  const mutation = useMutation({
    mutationFn: (values: ModuleFormValues) => {
      const payload = { title: values.title, description: values.description || null };
      return isEdit
        ? updateCourseModule(courseId, module!.id, payload)
        : createCourseModule(courseId, { ...payload, sort_order: nextSortOrder });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Module" : "New Module"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField
          label="Title"
          id="module-title"
          error={errors.title?.message}
          {...register("title", { required: "Title is required." })}
        />
        <TextAreaField label="Description" id="module-description" {...register("description")} />

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {mutation.error instanceof ApiClientError ? mutation.error.message : "Failed to save."}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create module"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
