import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCourseCategoryRequestSchema,
  type CourseCategoryResponse,
  type CreateCourseCategoryRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createCourseCategory, updateCourseCategory } from "../../../services/api/courseCategories";
import { listAllDepartments } from "../../../services/api/departments";

/**
 * Create/edit category (SYSTEM_PLAN.md §39's deferred `course_categories`
 * table, introduced now by this unit). Mirrors CourseFormModal.tsx's exact
 * shape — same create/update-share-a-schema pattern, same field-level 409
 * error surfacing. `is_active` is deliberately NOT a field here — activation/
 * deactivation is a one-click action on the list page (mirroring
 * AdminCourseDetailPage's Publish/Revert-to-Draft buttons), not bundled into
 * the descriptive-fields form.
 *
 * `department_id` (Department -> Category -> Training Content hierarchy
 * unit) reuses the existing `listAllDepartments()` helper (active
 * departments only) already used by CourseDepartmentsPanel.tsx/
 * CreateUserModal.tsx — an empty selection means "Global (no department)",
 * matching every other `*_department_id`-style field's null-means-global
 * convention.
 */
export function CourseCategoryFormModal({
  open,
  onClose,
  category,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  category?: CourseCategoryResponse;
  onSuccess: (category: CourseCategoryResponse) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!category;

  const departmentsQuery = useQuery({
    queryKey: ["all-departments"],
    queryFn: listAllDepartments,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateCourseCategoryRequest>({
    resolver: zodResolver(createCourseCategoryRequestSchema),
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      category
        ? {
            name: category.name,
            slug: category.slug,
            description: category.description ?? "",
            department_id: category.department_id ?? "",
          }
        : { name: "", slug: "", department_id: "" },
    );
  }, [open, category, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateCourseCategoryRequest) => {
      const normalized = {
        ...values,
        description: values.description || null,
        department_id: values.department_id || null,
      };
      return isEdit
        ? updateCourseCategory(category!.id, normalized)
        : createCourseCategory(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-course-categories"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateCourseCategoryRequest, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Category" : "New Category"}>
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
        <SelectField
          label="Department"
          id="department_id"
          error={errors.department_id?.message}
          {...register("department_id")}
        >
          <option value="">Global (no department)</option>
          {(departmentsQuery.data ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </SelectField>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
