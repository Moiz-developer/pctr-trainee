import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, UploadCloud } from "lucide-react";
import type { AdminAnnouncementResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import {
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
} from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { uploadAnnouncementMedia } from "../../../services/api/media";
import { createAnnouncement, updateAnnouncement } from "../../../services/api/adminAnnouncements";
import {
  getAnnouncementDepartments,
  setAnnouncementDepartments,
} from "../../../services/api/announcementDepartments";
import { listAllDepartments } from "../../../services/api/departments";

// Local form shape — `image_media_id`/`attachment_media_id` aren't
// registered fields (each file is tracked as local `File` state and
// resolved to an id at submit time, the same shape ResourceFormModal.tsx
// already established). `status` isn't a field either — publish/archive
// are one-click list-row actions (AdminAnnouncementsPage.tsx), matching
// Resources'/Policies' established convention.
const announcementFormSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]),
  is_important: z.boolean(),
  show_as_popup: z.boolean(),
});
type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create/edit an Announcement (SYSTEM_PLAN.md §14.6/§21/§26, Phase 5.3.2,
 * permission `announcement.manage`). Combines create/update, image +
 * attachment upload, and department targeting into one modal — mirrors
 * ResourceFormModal.tsx's exact shape, adapted for TWO optional media
 * fields (a banner `image` and a document `attachment`, both nullable per
 * §14.6) instead of Resources' one required file. Publishing/archiving are
 * separate one-click list-row actions; `is_important`/`show_as_popup` are
 * plain fields here (Phase 5.3.6 adds `show_as_popup` — the one field this
 * form omitted until now — since without an admin-facing toggle for it,
 * §14.6's popup mechanism, wired up in Phase 5.3.6, would have no
 * announcement ever eligible to trigger it).
 */
export function AnnouncementFormModal({
  open,
  onClose,
  announcement,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  announcement?: AdminAnnouncementResponse;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!announcement;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  // Same "derive during render, null until touched" shape as
  // CourseDepartmentsPanel.tsx's/ResourceFormModal.tsx's `pendingSelection`.
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  const allDepartments = useQuery({
    queryKey: ["all-departments"],
    queryFn: listAllDepartments,
    enabled: open,
  });
  const assignedDepartments = useQuery({
    queryKey: ["announcement-departments", announcement?.id],
    queryFn: () => getAnnouncementDepartments(announcement!.id),
    enabled: open && isEdit,
  });
  const assignedIds = useMemo(
    () => new Set((assignedDepartments.data ?? []).map((d) => d.id)),
    [assignedDepartments.data],
  );
  const selectedDepartments = pendingSelection ?? assignedIds;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: "",
      body: "",
      priority: "NORMAL",
      is_important: false,
      show_as_popup: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      announcement
        ? {
            title: announcement.title,
            body: announcement.body,
            priority: announcement.priority,
            is_important: announcement.is_important,
            show_as_popup: announcement.show_as_popup,
          }
        : { title: "", body: "", priority: "NORMAL", is_important: false, show_as_popup: false },
    );
  }, [open, announcement, reset]);

  function toggleDepartment(departmentId: string) {
    const next = new Set(selectedDepartments);
    if (next.has(departmentId)) next.delete(departmentId);
    else next.add(departmentId);
    setPendingSelection(next);
  }

  function handleClose() {
    setImageFile(null);
    setAttachmentFile(null);
    setPendingSelection(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: AnnouncementFormValues) => {
      const image_media_id = imageFile ? (await uploadAnnouncementMedia(imageFile)).id : undefined;
      const attachment_media_id = attachmentFile
        ? (await uploadAnnouncementMedia(attachmentFile)).id
        : undefined;

      const payload = {
        ...values,
        ...(image_media_id !== undefined ? { image_media_id } : {}),
        ...(attachment_media_id !== undefined ? { attachment_media_id } : {}),
      };

      const saved = isEdit
        ? await updateAnnouncement(announcement!.id, payload)
        : await createAnnouncement(payload);

      await setAnnouncementDepartments(saved.id, [...selectedDepartments]);
      return saved;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success(isEdit ? "Announcement updated." : "Announcement created.");
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof AnnouncementFormValues, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the announcement.");
    },
  });

  const departments = useMemo(() => allDepartments.data ?? [], [allDepartments.data]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit Announcement" : "New Announcement"}
      wide
    >
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField label="Title" id="a-title" error={errors.title?.message} {...register("title")} />
        <TextAreaField
          label="Description"
          id="a-body"
          error={errors.body?.message}
          {...register("body")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Priority"
            id="a-priority"
            error={errors.priority?.message}
            {...register("priority")}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </SelectField>
          <div className="pb-2">
            <div className="flex items-end gap-4">
              <CheckboxField
                id="a-important"
                label="Mark as Important"
                {...register("is_important")}
              />
              <CheckboxField
                id="a-popup"
                label="Show as popup"
                {...register("show_as_popup")}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              These are independent: check both to have an important announcement appear as a
              popup on Trainer Portal open.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="a-image" className="block text-sm font-medium text-slate-700">
              Banner Image
            </label>
            <div className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <ImageIcon className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <label htmlFor="a-image" className="mt-2 block text-xs text-slate-600">
                {isEdit ? "Replace image (optional)" : "Upload an image (optional)"}
              </label>
              <input
                id="a-image"
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-xs text-slate-600"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
              {imageFile && (
                <p className="mt-1 text-xs text-slate-500">
                  {imageFile.name} ({formatBytes(imageFile.size)})
                </p>
              )}
              {isEdit && !imageFile && announcement!.image_media_id && (
                <p className="mt-1 text-xs text-slate-500">An image is currently attached.</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="a-attachment" className="block text-sm font-medium text-slate-700">
              Attachment
            </label>
            <div className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <UploadCloud className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <label htmlFor="a-attachment" className="mt-2 block text-xs text-slate-600">
                {isEdit ? "Replace attachment (optional)" : "Upload an attachment (optional)"}
              </label>
              <input
                id="a-attachment"
                type="file"
                className="mt-2 block w-full text-xs text-slate-600"
                onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
              />
              {attachmentFile && (
                <p className="mt-1 text-xs text-slate-500">
                  {attachmentFile.name} ({formatBytes(attachmentFile.size)})
                </p>
              )}
              {isEdit && !attachmentFile && announcement!.attachment_media_id && (
                <p className="mt-1 text-xs text-slate-500">A document is currently attached.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700">Department Visibility</span>
          <p className="mt-0.5 text-xs text-slate-500">
            Leave every department unchecked to make this announcement visible to everyone.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <CheckboxField
                key={department.id}
                id={`a-dept-${department.id}`}
                label={department.name}
                checked={selectedDepartments.has(department.id)}
                onChange={() => toggleDepartment(department.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create announcement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
