import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import {
  createCourseRequestSchema,
  type CourseResponse,
  type CreateCourseRequest,
} from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import {
  TextField,
  RichTextField,
  CheckboxField,
  SelectField,
} from "../../../components/ui/FormField";
import { MediaImage } from "../../../components/shared/MediaImage";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { uploadCourseMedia } from "../../../services/api/media";
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
  const toast = useToast();
  const isEdit = !!course;
  // Cover image (Course image upload unit): tracked as local `File` state and uploaded
  // (course-media) at submit time, the same shape ModuleFormModal.tsx uses for its own image —
  // not a react-hook-form field, since its value is a signed media id resolved only on submit.
  // `imagePreviewUrl` is a local, revoked-on-change object URL purely for the live preview below —
  // never sent anywhere; the actual upload always reads from `imageFile` itself.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const categoriesQuery = useQuery({
    queryKey: ["active-course-categories"],
    queryFn: listActiveCourseCategories,
    enabled: open,
  });

  const {
    register,
    control,
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
    setImageFile(null);
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

  function handleClose() {
    setImageFile(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: CreateCourseRequest) => {
      const thumbnail_media_id = imageFile ? (await uploadCourseMedia(imageFile)).id : undefined;
      const normalized = {
        ...values,
        description: values.description || null,
        category_id: values.category_id || null,
        duration_minutes: values.duration_minutes || undefined,
        completion_min_assessment_score_pct:
          values.completion_min_assessment_score_pct ?? undefined,
        ...(thumbnail_media_id !== undefined ? { thumbnail_media_id } : {}),
      };
      return isEdit ? updateCourse(course!.id, normalized) : createCourse(normalized);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      toast.success(isEdit ? "Course updated." : "Course created.");
      onSuccess(result);
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateCourseRequest, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the course.");
    },
  });

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Edit Course" : "New Course"} wide>
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

        <div>
          <label htmlFor="course-thumbnail" className="block text-sm font-medium text-slate-700">
            Course Image
          </label>
          <div
            className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              // The native file input used to take dropped files itself; it is visually hidden
              // now, so the box takes them (images only, like the picker) — same shape
              // ModuleFormModal.tsx's own drop zone uses.
              event.preventDefault();
              const dropped = event.dataTransfer.files?.[0];
              if (dropped?.type.startsWith("image/")) setImageFile(dropped);
            }}
          >
            {isEdit && !imageFile && course!.thumbnail_media_id ? (
              <span className="mx-auto block h-24 w-40 overflow-hidden rounded bg-slate-100">
                <MediaImage
                  mediaAssetId={course!.thumbnail_media_id}
                  className="h-full w-full object-cover"
                  fallback={null}
                />
              </span>
            ) : imagePreviewUrl ? (
              <span className="mx-auto block h-24 w-40 overflow-hidden rounded bg-slate-100">
                <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <ImageIcon className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            )}
            <p className="mt-2 text-xs text-slate-600">
              {isEdit && course?.thumbnail_media_id
                ? "Replace image (optional)"
                : "Upload an image (optional)"}
            </p>
            <label
              htmlFor="course-thumbnail"
              className="mt-2 inline-flex cursor-pointer items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 transition-colors focus-within:ring-2 focus-within:ring-indigo-900 hover:bg-indigo-100"
            >
              {imageFile ? "Choose a different image" : "Browse files"}
              <input
                id="course-thumbnail"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {imageFile && <p className="mt-1 text-xs text-slate-500">{imageFile.name}</p>}
          </div>
        </div>

        <RichTextField label="Description" id="description" control={control} name="description" />
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create course"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
