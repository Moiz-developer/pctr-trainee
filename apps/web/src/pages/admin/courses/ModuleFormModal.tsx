import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import type { CourseModuleResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, RichTextField } from "../../../components/ui/FormField";
import { MediaImage } from "../../../components/shared/MediaImage";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { uploadCourseMedia } from "../../../services/api/media";
import { createCourseModule, updateCourseModule } from "../../../services/api/courseModules";

interface ModuleFormValues {
  title: string;
  description: string;
}

/**
 * `sort_order` is deliberately not a form field — new modules are appended
 * (nextSortOrder), and reordering existing ones happens via the up/down
 * controls in CourseModulesPanel, not by hand-typing a number here. The optional
 * cover image is tracked as local `File` state and uploaded (course-media) at
 * submit time, the same shape AnnouncementFormModal.tsx uses for its image.
 */
export function ModuleFormModal({
  open,
  onClose,
  courseId,
  module,
  nextSortOrder,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  module?: CourseModuleResponse;
  nextSortOrder: number;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!module;
  const [imageFile, setImageFile] = useState<File | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ModuleFormValues>({ defaultValues: { title: "", description: "" } });

  useEffect(() => {
    if (!open) return;
    reset({ title: module?.title ?? "", description: module?.description ?? "" });
  }, [open, module, reset]);

  function handleClose() {
    setImageFile(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: ModuleFormValues) => {
      const image_media_id = imageFile ? (await uploadCourseMedia(imageFile)).id : undefined;
      const payload = {
        title: values.title,
        description: values.description || null,
        ...(image_media_id !== undefined ? { image_media_id } : {}),
      };
      return isEdit
        ? updateCourseModule(courseId, module!.id, payload)
        : createCourseModule(courseId, { ...payload, sort_order: nextSortOrder });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
      toast.success(isEdit ? "Module updated." : "Module created.");
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the module.");
    },
  });

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Edit Module" : "New Module"}>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField
          label="Title"
          id="module-title"
          error={errors.title?.message}
          {...register("title", { required: "Title is required." })}
        />
        <RichTextField
          label="Description"
          id="module-description"
          control={control}
          name="description"
        />

        <div>
          <label htmlFor="module-image" className="block text-sm font-medium text-slate-700">
            Image
          </label>
          <div
            className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              // The native file input used to take dropped files itself; it is visually hidden
              // now, so the box takes them (images only, like the picker).
              event.preventDefault();
              const dropped = event.dataTransfer.files?.[0];
              if (dropped?.type.startsWith("image/")) setImageFile(dropped);
            }}
          >
            {isEdit && !imageFile && module!.image_media_id ? (
              <span className="mx-auto block h-24 w-40 overflow-hidden rounded bg-slate-100">
                <MediaImage
                  mediaAssetId={module!.image_media_id}
                  className="h-full w-full object-cover"
                  fallback={null}
                />
              </span>
            ) : (
              <ImageIcon className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            )}
            <p className="mt-2 text-xs text-slate-600">
              {isEdit && module!.image_media_id
                ? "Replace image (optional)"
                : "Upload an image (optional)"}
            </p>
            {/* The browser's own file input also prints the chosen file name, which showed the
                name twice next to ours below: the input stays (hidden, keyboard-focusable) and
                this button-styled label is what people click. */}
            <label
              htmlFor="module-image"
              className="mt-2 inline-flex cursor-pointer items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 transition-colors focus-within:ring-2 focus-within:ring-indigo-900 hover:bg-indigo-100"
            >
              {imageFile ? "Choose a different image" : "Browse files"}
              <input
                id="module-image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {imageFile && <p className="mt-1 text-xs text-slate-500">{imageFile.name}</p>}
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
                : "Create module"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
