import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRoleRequestSchema,
  type RoleResponse,
  type CreateRoleRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createRole, updateRole } from "../../../services/api/roles";

/**
 * Create/edit a role (Admin Role & Permission Management). Mirrors
 * ResourceCategoryFormModal.tsx's exact create/update-share-a-schema shape.
 * `code` is only a field on CREATE — `updateRoleRequestSchema` (shared
 * package) doesn't accept it at all, matching this feature's own
 * "code is immutable after creation" design, so the edit form simply omits
 * that input rather than rendering a disabled one. `is_system` is never a
 * form field — server-controlled, always `false` for a role created here.
 */
export function RoleFormModal({
  open,
  onClose,
  role,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  role?: RoleResponse;
  onSuccess: (role: RoleResponse) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!role;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateRoleRequest>({
    resolver: zodResolver(createRoleRequestSchema),
    defaultValues: { code: "", name: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      role
        ? { code: role.code, name: role.name, description: role.description ?? "" }
        : { code: "", name: "" },
    );
  }, [open, role, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateRoleRequest) => {
      const normalized = { ...values, description: values.description || null };
      return isEdit
        ? updateRole(role!.id, { name: normalized.name, description: normalized.description })
        : createRole(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateRoleRequest, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Role" : "New Role"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        {!isEdit && (
          <TextField
            label="Code"
            id="role-code"
            error={errors.code?.message}
            {...register("code")}
            placeholder="e.g. SUPPORT_STAFF"
          />
        )}
        <TextField label="Name" id="role-name" error={errors.name?.message} {...register("name")} />
        <TextAreaField
          label="Description"
          id="role-description"
          error={errors.description?.message}
          {...register("description")}
        />

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
