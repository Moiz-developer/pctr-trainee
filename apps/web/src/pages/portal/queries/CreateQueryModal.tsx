import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { createQueryRequestSchema, type CreateQueryRequest } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { createQuery, listQueryCategories } from "../../../services/api/queries";
import { listUserCourses } from "../../../services/api/userCourses";
import { uploadQueryAttachment } from "../../../services/api/media";

/**
 * Create a support ticket (SYSTEM_PLAN.md §14.7/§22/§26 `POST /queries`,
 * "self"). `course` is optional and, when set, only ever offers courses the
 * caller can already see (the same `GET /courses` catalogue the Course
 * Catalogue page uses) — never an arbitrary id typed by hand. `status` is
 * not a field here: every new ticket starts `OPEN` server-side.
 *
 * Query Category dropdown unit: `category` (the field this dropdown used to
 * submit, free text) is no longer used by this form — `category_id` is,
 * offering only active `query_categories` rows (the same `GET
 * /queries/categories` + `SelectField` shape `q-course` below already
 * establishes for Related Course), so a trainee can no longer submit
 * arbitrary category text here. `createQueryRequestSchema` still accepts
 * the legacy `category` field for other callers/backward compatibility —
 * this form simply never sends it.
 *
 * `attachment` (Phase 6.2) is not a react-hook-form field — it's a plain
 * `File` in local state, uploaded via the existing generic media flow
 * (`uploadQueryAttachment`, purpose `query-attachments`) immediately before
 * the ticket itself is created, so `createQuery` only ever needs the
 * resulting `media_asset_id`, never the raw file.
 */
export function CreateQueryModal({
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
  const [attachment, setAttachment] = useState<File | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["user-courses"],
    queryFn: () => listUserCourses({ pageSize: 100 }),
    enabled: open,
  });
  const categoriesQuery = useQuery({
    queryKey: ["query-categories"],
    queryFn: listQueryCategories,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateQueryRequest>({
    resolver: zodResolver(createQueryRequestSchema),
    defaultValues: { subject: "", description: "", priority: "NORMAL" },
  });

  // Resets the file input on every close path (Cancel, backdrop, Escape, or
  // a successful submit) — Modal.tsx routes all of those through this same
  // callback, so wrapping it here (rather than an open-triggered effect)
  // keeps the reset out of an effect body entirely.
  function handleClose() {
    setAttachment(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: CreateQueryRequest) => {
      const media_asset_id = attachment ? (await uploadQueryAttachment(attachment)).id : undefined;
      return createQuery({
        ...values,
        category_id: values.category_id || undefined,
        course_id: values.course_id || undefined,
        media_asset_id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-queries"] });
      toast.success("Query submitted.");
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof CreateQueryRequest, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to submit the query.");
    },
  });

  useEffect(() => {
    if (!open) return;
    // Resets any stale isPending/isError/error left over from a previous
    // open/submit of this same, never-unmounted modal instance — otherwise
    // the Submit button's `disabled={mutation.isPending}` could reflect a
    // prior session's in-flight or failed request instead of this one.
    mutation.reset();
    reset({ subject: "", category_id: "", description: "", priority: "NORMAL", course_id: "" });
  }, [open, reset]);

  return (
    <Modal open={open} onClose={handleClose} title="New Query" wide>
      <form
        className="space-y-4"
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
      >
        <TextField
          label="Subject"
          id="q-subject"
          error={errors.subject?.message}
          {...register("subject")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            id="q-category"
            error={errors.category_id?.message}
            {...register("category_id")}
          >
            <option value="">None</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Priority"
            id="q-priority"
            error={errors.priority?.message}
            {...register("priority")}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </SelectField>
        </div>
        <SelectField
          label="Related Course"
          id="q-course"
          error={errors.course_id?.message}
          {...register("course_id")}
        >
          <option value="">None</option>
          {(coursesQuery.data?.data ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Description"
          id="q-description"
          error={errors.description?.message}
          {...register("description")}
        />

        <div>
          <label htmlFor="q-attachment" className="block text-sm font-medium text-slate-700">
            Attachment
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              id="q-attachment"
              type="file"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </div>
          {attachment && (
            <p className="mt-1 text-xs text-slate-500">
              {attachment.name} ({Math.ceil(attachment.size / 1024)} KB)
            </p>
          )}
          {errors.media_asset_id?.message && (
            <p className="mt-1 text-xs text-red-600">{errors.media_asset_id.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? "Submitting…" : "Submit Query"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
