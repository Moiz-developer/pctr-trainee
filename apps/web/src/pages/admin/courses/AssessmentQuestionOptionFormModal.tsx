import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssessmentQuestionOptionResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, CheckboxField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import {
  createAssessmentQuestionOption,
  updateAssessmentQuestionOption,
} from "../../../services/api/adminAssessments";

interface OptionFormValues {
  option_text: string;
  is_correct: boolean;
}

export function AssessmentQuestionOptionFormModal({
  open,
  onClose,
  courseId,
  assessmentId,
  questionId,
  option,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  assessmentId: string;
  questionId: string;
  option?: AssessmentQuestionOptionResponse;
  nextSortOrder: number;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!option;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OptionFormValues>({ defaultValues: { option_text: "", is_correct: false } });

  useEffect(() => {
    if (!open) return;
    reset(
      option
        ? { option_text: option.option_text, is_correct: option.is_correct }
        : { option_text: "", is_correct: false },
    );
  }, [open, option, reset]);

  const mutation = useMutation({
    mutationFn: (values: OptionFormValues) =>
      isEdit
        ? updateAssessmentQuestionOption(courseId, assessmentId, questionId, option!.id, values)
        : createAssessmentQuestionOption(courseId, assessmentId, questionId, {
            ...values,
            sort_order: nextSortOrder,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["assessment-question-options", questionId],
      });
      onClose();
    },
  });

  const submitError = mutation.error instanceof ApiClientError ? mutation.error.message : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Option" : "New Option"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField
          label="Option Text"
          id="o-text"
          error={errors.option_text?.message}
          {...register("option_text", { required: "Option text is required." })}
        />
        <CheckboxField
          label="This is the correct answer"
          id="o-correct"
          {...register("is_correct")}
        />

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add option"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
