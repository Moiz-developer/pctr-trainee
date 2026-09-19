import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AssessmentResponse,
  AssessmentType,
  CreateAssessmentRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { createAssessment, updateAssessment } from "../../../services/api/adminAssessments";

/**
 * Create/edit an assessment (SYSTEM_PLAN.md §14.4, permission
 * `assessment.manage`). `status` is not a field here — publish/archive is a
 * one-click action on AssessmentsPanel's list (mirroring
 * AdminCourseDetailPage's Publish/Revert-to-Draft pattern), not bundled
 * into the descriptive-fields form.
 *
 * No zodResolver here (unlike most other create/edit modals): `due_date`'s
 * native `<input type="datetime-local">` value ("2026-01-01T12:00", no
 * offset) doesn't match the API contract's full-offset ISO string, so this
 * form uses its own local values type and converts on submit — mirroring
 * ModuleFormModal's simpler, resolver-free shape rather than fighting the
 * browser input format against `isoDateStringSchema`.
 */
interface AssessmentFormValues {
  title: string;
  description: string;
  type: AssessmentType;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number | "";
  due_date: string;
  max_attempts: number;
}

const DEFAULT_VALUES: AssessmentFormValues = {
  title: "",
  description: "",
  type: "QUIZ",
  total_marks: 100,
  passing_marks: 50,
  duration_minutes: "",
  due_date: "",
  max_attempts: 1,
};

export function AssessmentFormModal({
  open,
  onClose,
  courseId,
  assessment,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  assessment?: AssessmentResponse;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!assessment;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AssessmentFormValues>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (!open) return;
    reset(
      assessment
        ? {
            title: assessment.title,
            description: assessment.description ?? "",
            type: assessment.type,
            total_marks: assessment.total_marks,
            passing_marks: assessment.passing_marks,
            duration_minutes: assessment.duration_minutes ?? "",
            // Slice to "YYYY-MM-DDTHH:mm" — the exact value a datetime-local input accepts.
            due_date: assessment.due_date ? assessment.due_date.slice(0, 16) : "",
            max_attempts: assessment.max_attempts,
          }
        : DEFAULT_VALUES,
    );
  }, [open, assessment, reset]);

  const mutation = useMutation({
    mutationFn: (values: AssessmentFormValues) => {
      const payload: CreateAssessmentRequest = {
        title: values.title,
        description: values.description || null,
        type: values.type,
        total_marks: values.total_marks,
        passing_marks: values.passing_marks,
        duration_minutes:
          values.duration_minutes === "" || Number.isNaN(values.duration_minutes)
            ? null
            : values.duration_minutes,
        due_date: values.due_date ? new Date(values.due_date).toISOString() : null,
        max_attempts: values.max_attempts,
      };
      return isEdit
        ? updateAssessment(courseId, assessment!.id, payload)
        : createAssessment(courseId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessments", courseId] });
      toast.success(isEdit ? "Assessment updated." : "Assessment created.");
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof AssessmentFormValues, { message: messages[0] });
        }
        return;
      }
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to save the assessment.",
      );
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Assessment" : "New Assessment"} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField
          label="Title"
          id="a-title"
          error={errors.title?.message}
          {...register("title", { required: "Title is required." })}
        />
        <TextAreaField
          label="Description"
          id="a-description"
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Type" id="a-type" error={errors.type?.message} {...register("type")}>
            <option value="QUIZ">Quiz</option>
            <option value="MOCK_EXAM">Mock Exam</option>
            <option value="PRACTICAL">Practical</option>
            <option value="TEST">Test</option>
            <option value="OTHER">Other</option>
          </SelectField>
          <TextField
            label="Max Attempts"
            id="a-max-attempts"
            type="number"
            min="1"
            error={errors.max_attempts?.message}
            {...register("max_attempts", { valueAsNumber: true, required: true, min: 1 })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Total Marks"
            id="a-total-marks"
            type="number"
            min="1"
            error={errors.total_marks?.message}
            {...register("total_marks", { valueAsNumber: true, required: true, min: 1 })}
          />
          <TextField
            label="Passing Marks"
            id="a-passing-marks"
            type="number"
            min="0"
            error={errors.passing_marks?.message}
            {...register("passing_marks", { valueAsNumber: true, required: true, min: 0 })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Duration (minutes)"
            id="a-duration"
            type="number"
            min="1"
            error={errors.duration_minutes?.message}
            {...register("duration_minutes", { valueAsNumber: true })}
            placeholder="Optional"
          />
          <TextField
            label="Due Date"
            id="a-due-date"
            type="datetime-local"
            error={errors.due_date?.message}
            {...register("due_date")}
          />
        </div>

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
                : "Create assessment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
