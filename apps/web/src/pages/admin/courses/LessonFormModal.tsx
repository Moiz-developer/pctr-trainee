import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCourseLessonRequestSchema,
  type CourseLessonResponse,
  type CreateCourseLessonRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import {
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
} from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createCourseLesson, updateCourseLesson } from "../../../services/api/courseLessons";

/**
 * Validated with the SAME `createCourseLessonRequestSchema` the API uses
 * (packages/shared/src/api/course-lessons.ts) — including its content-type
 * field-consistency check (EXTERNAL_LINK needs external_url and forbids
 * text_content, TEXT is the reverse, VIDEO/PDF/DOCUMENT/PRESENTATION forbid
 * both) — so this form never re-implements that rule, only reuses it.
 * `sort_order` is supplied automatically by the lesson list for create and
 * preserved from the existing lesson for edit.
 */
export function LessonFormModal({
  open,
  onClose,
  courseId,
  moduleId,
  lesson,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  moduleId: string;
  lesson?: CourseLessonResponse;
  nextSortOrder: number;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!lesson;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateCourseLessonRequest>({
    resolver: zodResolver(createCourseLessonRequestSchema),
    defaultValues: {
      title: "",
      content_type: "TEXT",
      classification: "THEORETICAL",
      is_required: true,
    },
  });
  const contentType = watch("content_type");

  // Clears the other content-type-specific field whenever content_type
  // changes, so a value typed while a different type was selected can't be
  // left behind in RHF state after its own field (and error display)
  // unmounts — the schema's content-type/field-consistency rule would
  // otherwise reject that stale value with no way to show why.
  useEffect(() => {
    if (contentType !== "TEXT") setValue("text_content", undefined);
    if (contentType !== "EXTERNAL_LINK") setValue("external_url", undefined);
  }, [contentType, setValue]);

  const mutation = useMutation({
    mutationFn: (values: CreateCourseLessonRequest) => {
      // eslint-disable-next-line no-console
      console.log("[DIAG-9] mutationFn ENTERED with values:", values);
      const payload: CreateCourseLessonRequest = {
        ...values,
        description: values.description || null,
        duration_seconds: values.duration_seconds || undefined,
        external_url: values.content_type === "EXTERNAL_LINK" ? values.external_url : null,
        text_content: values.content_type === "TEXT" ? values.text_content : null,

      };
      // eslint-disable-next-line no-console
      console.log("[DIAG-9] mutationFn computed payload:", payload, "isEdit:", isEdit);
      const promise = isEdit
        ? updateCourseLesson(courseId, moduleId, lesson!.id, payload)
        : createCourseLesson(courseId, moduleId, { ...payload, sort_order: nextSortOrder });
      // eslint-disable-next-line no-console
      console.log("[DIAG-9] mutationFn about to return the API-call promise (network request initiated)");
      return promise;
    },
    onSuccess: async () => {
      // eslint-disable-next-line no-console
      console.log("[DIAG] mutation onSuccess fired");
      await queryClient.invalidateQueries({ queryKey: ["course-lessons", moduleId] });
      onClose();
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.log("[DIAG] mutation onError fired:", err);
    },
  });

  useEffect(() => {
    if (!open) return;
    // Resets any stale isPending/isError/error left over from a previous
    // open/submit of this same, never-unmounted modal instance — otherwise
    // the Create/Save button's `disabled={mutation.isPending}` could reflect
    // a prior session's in-flight or failed request instead of this one.
    mutation.reset();
    reset(
      lesson
        ? {
            title: lesson.title,
            description: lesson.description ?? "",
            content_type: lesson.content_type,
            classification: lesson.classification,
            is_required: lesson.is_required,
            duration_seconds: lesson.duration_seconds ?? undefined,
            external_url: lesson.external_url ?? "",
            text_content: lesson.text_content ?? "",
            sort_order: lesson.sort_order,
          }
        : {
            title: "",
            description: "",
            content_type: "TEXT",
            classification: "THEORETICAL",
            is_required: true,
            sort_order: nextSortOrder,
          },
    );
  }, [open, lesson,nextSortOrder, reset]);

  const submitError =
    mutation.error instanceof ApiClientError
      ? mutation.error.message
      : mutation.isError
        ? "Failed to save."
        : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Lesson" : "New Lesson"} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          // eslint-disable-next-line no-console
          console.log("[DIAG-1] native form submit event reached <form>", {
            defaultPrevented: event.defaultPrevented,
          });
          // eslint-disable-next-line no-console
          console.log("[DIAG-5] formState snapshot before handleSubmit:", {
            isValid,
            isSubmitting,
            errors,
          });
          const currentValues = getValues();
          // eslint-disable-next-line no-console
          console.log("[DIAG-6] contentType at click time:", currentValues.content_type);
          // eslint-disable-next-line no-console
          console.log("[DIAG-7] full field values at click time:", {
            title: currentValues.title,
            description: currentValues.description,
            content_type: currentValues.content_type,
            text_content: currentValues.text_content,
            external_url: currentValues.external_url,
            duration_seconds: currentValues.duration_seconds,
            classification: currentValues.classification,
            is_required: currentValues.is_required,
            sort_order: (currentValues as { sort_order?: number }).sort_order,
          });
          // eslint-disable-next-line no-console
          console.log("[DIAG-2] calling handleSubmit(onValid, onInvalid) now");
          void handleSubmit(
            (values) => {
              // eslint-disable-next-line no-console
              console.log("[DIAG-3] onValid FIRED — complete submitted values:", values);
              // eslint-disable-next-line no-console
              console.log("[DIAG-8] calling mutation.mutate(values) now");
              mutation.mutate(values);
              // eslint-disable-next-line no-console
              console.log("[DIAG-8] mutation.mutate(values) call returned (fire-and-forget, does not await)");
            },
            (invalidErrors) => {
              // eslint-disable-next-line no-console
              console.log("[DIAG-4] onInvalid FIRED — complete RHF errors object:", invalidErrors);
            },
          )(event);
        }}
      >
        <TextField
          label="Title"
          id="lesson-title"
          error={errors.title?.message}
          {...register("title")}
        />
        <TextAreaField
          label="Description"
          id="lesson-description"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Content type"
            id="lesson-content-type"
            error={errors.content_type?.message}
            {...register("content_type")}
          >
            <option value="VIDEO">Video</option>
            <option value="PDF">PDF</option>
            <option value="DOCUMENT">Document</option>
            <option value="PRESENTATION">Presentation</option>
            <option value="EXTERNAL_LINK">External Link / Video (YouTube, Vimeo)</option>
            <option value="TEXT">Text</option>
          </SelectField>
          <SelectField
            label="Classification"
            id="lesson-classification"
            {...register("classification")}
          >
            <option value="THEORETICAL">Theoretical</option>
            <option value="PRACTICAL">Practical</option>
          </SelectField>
          <TextField
            label="Duration (seconds)"
            id="lesson-duration"
            type="number"
            min={0}
            error={errors.duration_seconds?.message}
            {...register("duration_seconds", {
              setValueAs: (value) => (value === "" ? undefined : Number(value)),
            })}
          />
        </div>

        {contentType === "EXTERNAL_LINK" && (
          <div>
            <TextField
              label="External URL"
              id="lesson-external-url"
              type="url"
              placeholder="e.g. https://vimeo.com/123456789"
              error={errors.external_url?.message}
              {...register("external_url")}
            />
            <p className="mt-1 text-xs text-slate-500">
              Vimeo and YouTube links play embedded, right inside the lesson, in the Trainer
              Portal — no download needed. Any other link opens as a plain "Open Resource" link
              instead.
            </p>
          </div>
        )}
        {contentType === "TEXT" && (
          <TextAreaField
            label="Text content"
            id="lesson-text-content"
            error={errors.text_content?.message}
            {...register("text_content")}
          />
        )}
        {(contentType === "VIDEO" ||
          contentType === "PDF" ||
          contentType === "DOCUMENT" ||
          contentType === "PRESENTATION") && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Media for this lesson is attached separately, after saving, from the lesson's "Media"
            button.
          </p>
        )}

        <CheckboxField
          label="Required for completion"
          id="lesson-required"
          {...register("is_required")}
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
                : "Create lesson"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
