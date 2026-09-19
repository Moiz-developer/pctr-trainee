import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateUserRequestSchema,
  type AdminUserResponse,
  type UpdateUserRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, SelectField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { updateUser } from "../../../services/api/users";

/**
 * Edit a user's own fields (Admin Users + Departments UI unit). Deliberately
 * excludes departments — `updateUserRequestSchema` itself excludes
 * `department_ids` (see packages/shared/src/api/admin-users.ts's own doc
 * comment: "left to a future dedicated endpoint"); department management
 * lives in the separate ManageUserDepartmentsModal, mirroring how Course
 * Access is a separate concern from CourseFormModal.
 */
export function EditUserModal({
  open,
  onClose,
  user,
  availableRoles,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUserResponse;
  availableRoles: { id: string; code: string; name: string }[];
  onSuccess: (user: AdminUserResponse) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<UpdateUserRequest>({
    resolver: zodResolver(updateUserRequestSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone ?? "",
      role_id: user.role.id,
      employee_id: user.employee_id,
      status: user.status,
    });
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: (values: UpdateUserRequest) =>
      updateUser(user.id, { ...values, phone: values.phone || null }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated.");
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof UpdateUserRequest, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the user.");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Edit User — ${user.full_name}`} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Full Name"
            id="edit-full_name"
            error={errors.full_name?.message}
            {...register("full_name")}
          />
          <TextField
            label="Employee ID"
            id="edit-employee_id"
            error={errors.employee_id?.message}
            {...register("employee_id")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            id="edit-email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            label="Phone"
            id="edit-phone"
            error={errors.phone?.message}
            {...register("phone")}
            placeholder="Optional"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Role"
            id="edit-role_id"
            error={errors.role_id?.message}
            {...register("role_id")}
          >
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            id="edit-status"
            error={errors.status?.message}
            {...register("status")}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </SelectField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
