import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createDepartmentRequestSchema,
  type CreateDepartmentRequest,
  type DepartmentResponse,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createDepartment, updateDepartment } from "../../../services/api/departments";

/**
 * Create/edit department (Admin Users + Departments UI unit). Mirrors
 * CourseCategoryFormModal.tsx field-for-field — Department and
 * CourseCategory share the exact same admin-managed-lookup-table shape
 * (name/slug/description/is_active). `is_active` is deliberately NOT a
 * field here — activation/deactivation is the list page's one-click action
 * (same split as categories), not bundled into the descriptive-fields form.
 */
export function DepartmentFormModal({
  open,
  onClose,
  department,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  department?: DepartmentResponse;
  onSuccess: (department: DepartmentResponse) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!department;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateDepartmentRequest>({
    resolver: zodResolver(createDepartmentRequestSchema),
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      department
        ? {
            name: department.name,
            slug: department.slug,
            description: department.description ?? "",
          }
        : { name: "", slug: "" },
    );
  }, [open, department, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateDepartmentRequest) => {
      const normalized = { ...values, description: values.description || null };
      return isEdit ? updateDepartment(department!.id, normalized) : createDepartment(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateDepartmentRequest, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Department" : "New Department"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField label="Name" id="name" error={errors.name?.message} {...register("name")} />
        <TextField
          label="Slug"
          id="slug"
          error={errors.slug?.message}
          {...register("slug")}
          placeholder="e.g. sales"
        />
        <TextAreaField
          label="Description"
          id="description"
          error={errors.description?.message}
          {...register("description")}
        />

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

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
                : "Create department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
