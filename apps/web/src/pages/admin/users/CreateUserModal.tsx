import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserRequestSchema,
  type AdminUserResponse,
  type CreateUserRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, SelectField, CheckboxField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createUser } from "../../../services/api/users";
import { listAllDepartments } from "../../../services/api/departments";

/**
 * Create a user (Admin Users + Departments UI unit; SYSTEM_PLAN.md §9's
 * admin-created-user flow). No password field exists here because the API
 * accepts none — `createUserRequestSchema` has no password field at all,
 * matching §9's "admins create users without setting a password; the
 * Supabase invite/reset-link flow is used instead."
 *
 * `role_id` options come from `availableRoles` — passed down by
 * AdminUsersPage.tsx from the real `GET /admin/roles` endpoint (Admin Role
 * & Permission Management unit), replacing the previous roster-scraping
 * workaround this comment used to describe. Department options come from
 * the existing `listAllDepartments()` helper (active departments only),
 * already used by CourseDepartmentsPanel.tsx — reused unchanged.
 */
export function CreateUserModal({
  open,
  onClose,
  availableRoles,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  availableRoles: { id: string; code: string; name: string }[];
  onSuccess: (user: AdminUserResponse) => void;
}) {
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ["active-departments"],
    queryFn: listAllDepartments,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateUserRequest>({
    resolver: zodResolver(createUserRequestSchema),
    defaultValues: { employee_id: "", full_name: "", email: "", role_id: "", department_ids: [] },
  });

  useEffect(() => {
    if (!open) return;
    reset({ employee_id: "", full_name: "", email: "", role_id: "", department_ids: [] });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateUserRequest) =>
      createUser({ ...values, phone: values.phone || undefined }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateUserRequest, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={onClose} title="New User" wide>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Full Name"
            id="full_name"
            error={errors.full_name?.message}
            {...register("full_name")}
          />
          <TextField
            label="Employee ID"
            id="employee_id"
            error={errors.employee_id?.message}
            {...register("employee_id")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            id="email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <TextField
            label="Phone"
            id="phone"
            error={errors.phone?.message}
            {...register("phone")}
            placeholder="Optional"
          />
        </div>

        <SelectField
          label="Role"
          id="role_id"
          error={errors.role_id?.message}
          {...register("role_id")}
        >
          <option value="">Select a role…</option>
          {availableRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </SelectField>

        <div>
          <p className="block text-sm font-medium text-slate-700">Departments</p>
          <div className="mt-1 space-y-1.5 rounded-lg border border-slate-200 p-3">
            {(departmentsQuery.data ?? []).map((department) => (
              <CheckboxField
                key={department.id}
                label={department.name}
                id={`create-user-dept-${department.id}`}
                value={department.id}
                {...register("department_ids")}
              />
            ))}
            {departmentsQuery.data?.length === 0 && (
              <p className="text-xs text-slate-400">No active departments exist yet.</p>
            )}
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? "Inviting…" : "Invite user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
