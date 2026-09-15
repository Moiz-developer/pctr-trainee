import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCourseRequestSchema,
  type CourseResponse,
  type CreateCourseRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import {
  TextField,
  TextAreaField,
  CheckboxField,
  SelectField,
} from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { createCourse, updateCourse } from "../../../services/api/courses";
import { listActiveCourseCategories } from "../../../services/api/courseCategories";

/**
 * Create/edit are the same form — the backend's create/update request
 * schemas share the same editable field set (SYSTEM_PLAN.md §14.2's Course
 * columns); `status`/`slug` uniqueness/duplicate handling is the same 409
 * either way (see courses.service.ts on the API side).
 */
export function CourseFormModal({
  open,
  onClose,
  course,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  course?: CourseResponse;
  onSuccess: (course: CourseResponse) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!course;

  const categoriesQuery = useQuery({
    queryKey: ["active-course-categories"],
    queryFn: listActiveCourseCategories,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateCourseRequest>({
    resolver: zodResolver(createCourseRequestSchema),
    defaultValues: { title: "", slug: "", category_id: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      course
        ? {
            title: course.title,
            slug: course.slug,
            description: course.description ?? "",
            category_id: course.category?.id ?? "",
            duration_minutes: course.duration_minutes ?? undefined,
            completion_require_all_lessons: course.completion_require_all_lessons,
            completion_require_practical: course.completion_require_practical,
            completion_require_assessment_pass: course.completion_require_assessment_pass,
            completion_min_assessment_score_pct:
              course.completion_min_assessment_score_pct ?? undefined,
          }
        : {
            title: "",
            slug: "",
            category_id: "",
            completion_require_all_lessons: true,
            completion_require_practical: true,
          },
    );
  }, [open, course, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateCourseRequest) => {
      const normalized = {
        ...values,
        description: values.description || null,
        category_id: values.category_id || null,
        duration_minutes: values.duration_minutes || undefined,
        completion_min_assessment_score_pct:
          values.completion_min_assessment_score_pct ?? undefined,
      };
      return isEdit ? updateCourse(course!.id, normalized) : createCourse(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      onSuccess(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateCourseRequest, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Course" : "New Course"} wide>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Title"
            id="title"
            error={errors.title?.message}
            {...register("title")}
          />
          <TextField
            label="Slug"
            id="slug"
            error={errors.slug?.message}
            {...register("slug")}
            placeholder="e.g. workplace-safety-101"
          />
        </div>
        <TextAreaField
          label="Description"
          id="description"
          error={errors.description?.message}
          {...register("description")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            id="category_id"
            error={errors.category_id?.message}
            {...register("category_id")}
          >
            <option value="">No category</option>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            {/*
              The dropdown only lists active categories (courses.service.ts
              rejects assigning an inactive one), but a course already
              assigned to a category that's since been deactivated must still
              show it here — not silently swap to "No category" and clear it
              on the next unrelated save. Shown disabled: visible, but not
              re-selectable as a new choice for this or any other course.
            */}
            {course?.category &&
              !categoriesQuery.data?.some((c) => c.id === course.category!.id) && (
                <option value={course.category.id} disabled>
                  {course.category.name} (inactive)
                </option>
              )}
          </SelectField>
          <TextField
            label="Duration (minutes)"
            id="duration_minutes"
            type="number"
            min={1}
            error={errors.duration_minutes?.message}
            {...register("duration_minutes", { valueAsNumber: true })}
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Completion criteria
          </p>
          <div className="mt-2 space-y-2">
            <CheckboxField
              label="Require all lessons to be completed"
              id="completion_require_all_lessons"
              {...register("completion_require_all_lessons")}
            />
            <CheckboxField
              label="Require practical lessons"
              id="completion_require_practical"
              {...register("completion_require_practical")}
            />
            <CheckboxField
              label="Require passing an assessment"
              id="completion_require_assessment_pass"
              {...register("completion_require_assessment_pass")}
            />
            <TextField
              label="Minimum assessment score (%)"
              id="completion_min_assessment_score_pct"
              type="number"
              min={0}
              max={100}
              error={errors.completion_min_assessment_score_pct?.message}
              {...register("completion_min_assessment_score_pct", { valueAsNumber: true })}
            />
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create course"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
