import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTrainingHourRequirementRequestSchema,
  type CreateTrainingHourRequirementRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, SelectField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { createTrainingHourRequirement } from "../../../services/api/trainingHourRequirements";
import { listAllDepartments } from "../../../services/api/departments";
import { searchUsers } from "../../../services/api/users";

/**
 * New `training_hour_requirements` row (SYSTEM_PLAN.md §14.3). Create-only —
 * this table has no update/delete endpoint; see the shared schema's doc
 * comment for why. `scope` toggles which single picker (department vs.
 * user) is shown/required, matching the CHECK constraint enforced both
 * client- and server-side.
 */
export function TrainingHourRequirementFormModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const departmentsQuery = useQuery({
    queryKey: ["active-departments"],
    queryFn: listAllDepartments,
    enabled: open,
  });
  const usersQuery = useQuery({
    queryKey: ["user-search", ""],
    queryFn: () => searchUsers(""),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateTrainingHourRequirementRequest>({
    resolver: zodResolver(createTrainingHourRequirementRequestSchema),
    defaultValues: { scope: "DEPARTMENT", required_hours: 0, effective_from: "" },
  });

  const scope = watch("scope");

  useEffect(() => {
    if (!open) return;
    reset({ scope: "DEPARTMENT", required_hours: 0, effective_from: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: CreateTrainingHourRequirementRequest) =>
      createTrainingHourRequirement(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-training-hour-requirements"] });
      toast.success("Training hour requirement created.");
      onSuccess();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateTrainingHourRequirementRequest, { message: messages[0] });
        }
        return;
      }
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to save the requirement.",
      );
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Training Hour Requirement">
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <SelectField label="Scope" id="scope" error={errors.scope?.message} {...register("scope")}>
          <option value="DEPARTMENT">Department</option>
          <option value="USER">Individual User</option>
        </SelectField>

        {scope === "DEPARTMENT" ? (
          <SelectField
            label="Department"
            id="department_id"
            error={errors.department_id?.message}
            {...register("department_id")}
          >
            <option value="">Select a department…</option>
            {(departmentsQuery.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField
            label="User"
            id="user_id"
            error={errors.user_id?.message}
            {...register("user_id")}
          >
            <option value="">Select a user…</option>
            {(usersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.employee_id})
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          label="Required Hours"
          id="required_hours"
          type="number"
          step="0.25"
          min="0"
          error={errors.required_hours?.message}
          {...register("required_hours", { valueAsNumber: true })}
        />

        <TextField
          label="Effective From"
          id="effective_from"
          type="date"
          error={errors.effective_from?.message}
          {...register("effective_from")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? "Creating…" : "Create requirement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
