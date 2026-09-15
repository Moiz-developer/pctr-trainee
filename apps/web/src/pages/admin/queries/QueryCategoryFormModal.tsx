import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createQueryCategoryRequestSchema,
  type QueryCategoryResponse,
  type CreateQueryCategoryRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import {
  createQueryCategory,
  updateQueryCategory,
} from "../../../services/api/queryCategories";
import { listAllDepartments } from "../../../services/api/departments";

/**
 * Create/edit a Query category (Query Category dropdown unit). Mirrors
 * ResourceCategoryFormModal.tsx's exact shape — same create/update-share-a-
 * schema pattern, same field-level 409 error surfacing. `is_active` is
 * deliberately NOT a field here — activation/deactivation is a one-click
 * action on the list page.
 *
 * `department_id` (Department -> Category -> Training Content hierarchy
 * unit) mirrors CourseCategoryFormModal.tsx/ResourceCategoryFormModal.tsx's
 * identical addition — an empty selection means "Global (no department)".
 */
export function QueryCategoryFormModal({
  open,
  onClose,
  category,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  category?: QueryCategoryResponse;
  onSuccess: (category: QueryCategoryResponse) => void;
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
  } = useForm<CreateQueryCategoryRequest>({
    resolver: zodResolver(createQueryCategoryRequestSchema),
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
    mutationFn: async (values: CreateQueryCategoryRequest) => {
      const normalized = {
        ...values,
        description: values.description || null,
        department_id: values.department_id || null,
      };
      return isEdit
        ? updateQueryCategory(category!.id, normalized)
        : createQueryCategory(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-query-category-records"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateQueryCategoryRequest, { message: messages[0] });
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
          placeholder="e.g. technical-issue"
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
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create category"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
