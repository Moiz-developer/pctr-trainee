import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssessmentQuestionResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextAreaField, SelectField, TextField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import {
  createAssessmentQuestion,
  updateAssessmentQuestion,
} from "../../../services/api/adminAssessments";

interface QuestionFormValues {
  question_text: string;
  question_type:
    "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "PRACTICAL_MANUAL";
  marks: number;
}

/** `sort_order` is appended automatically (nextSortOrder), matching ModuleFormModal's convention. */
export function AssessmentQuestionFormModal({
  open,
  onClose,
  courseId,
  assessmentId,
  question,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  assessmentId: string;
  question?: AssessmentQuestionResponse;
  nextSortOrder: number;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!question;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues>({
    defaultValues: { question_text: "", question_type: "SINGLE_CHOICE", marks: 1 },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      question
        ? {
            question_text: question.question_text,
            question_type: question.question_type,
            marks: question.marks,
          }
        : { question_text: "", question_type: "SINGLE_CHOICE", marks: 1 },
    );
  }, [open, question, reset]);

  const mutation = useMutation({
    mutationFn: (values: QuestionFormValues) =>
      isEdit
        ? updateAssessmentQuestion(courseId, assessmentId, question!.id, values)
        : createAssessmentQuestion(courseId, assessmentId, {
            ...values,
            sort_order: nextSortOrder,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["assessment-questions", assessmentId] });
      onClose();
    },
  });

  const submitError = mutation.error instanceof ApiClientError ? mutation.error.message : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Question" : "New Question"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextAreaField
          label="Question Text"
          id="q-text"
          error={errors.question_text?.message}
          {...register("question_text", { required: "Question text is required." })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Question Type"
            id="q-type"
            error={errors.question_type?.message}
            {...register("question_type")}
          >
            <option value="SINGLE_CHOICE">Single Choice</option>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True / False</option>
            <option value="SHORT_ANSWER">Short Answer (manually graded)</option>
            <option value="PRACTICAL_MANUAL">Practical (manually graded)</option>
          </SelectField>
          <TextField
            label="Marks"
            id="q-marks"
            type="number"
            min="1"
            error={errors.marks?.message}
            {...register("marks", { valueAsNumber: true, required: true, min: 1 })}
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Adding…"
              : isEdit
                ? "Save changes"
                : "Add question"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
