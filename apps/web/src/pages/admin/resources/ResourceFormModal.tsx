import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import type { CreateResourceRequest, ResourceResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, RichTextField, SelectField, CheckboxField } from "../../../components/ui/FormField";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { uploadResourceFile } from "../../../services/api/media";
import { listActiveResourceCategories } from "../../../services/api/resourceCategories";
import { createResource, updateResource } from "../../../services/api/adminResources";
import { getResourceDepartments, setResourceDepartments } from "../../../services/api/resourceDepartments";
import { listAllDepartments } from "../../../services/api/departments";

// Local form shape — deliberately NOT `CreateResourceRequest`/
// `UpdateResourceRequest` (both require exactly one of `media_asset_id`/
// `external_url`, neither of which maps cleanly to a single always-required
// registered field here). The file is tracked as local `File` state and
// uploaded/resolved to an id inside the submit mutation, exactly the same
// "File in local state, id resolved at submit time" shape CreateQueryModal.tsx
// already established. `external_url` (Useful Link unit) IS a registered
// field — a plain text input, loosely typed here; its "required when in LINK
// mode" rule is enforced imperatively in the submit handler below, the same
// way the pre-existing "file required on create" rule already is, since
// that requirement depends on `sourceMode`, not a static shape this schema
// alone can express. `status` isn't a form field either — mirrors
// CourseCategoryFormModal's own reasoning: activation/archival is a
// one-click list-row action, not bundled into the descriptive-fields form.
const resourceFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  category_id: z.string().min(1, "Select a category"),
  external_url: z.string().optional(),
});
type ResourceFormValues = z.infer<typeof resourceFormSchema>;

type SourceMode = "FILE" | "LINK";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create/edit a Resource (SYSTEM_PLAN.md §14.5/§20/§26, Phase 5.1,
 * permission `resource.manage`). Combines what would otherwise be three
 * separate steps (create/update the resource, upload+attach its file,
 * set its department visibility) into one modal + one Save action — a
 * deliberately smaller surface than Courses' dedicated detail-page + nested
 * panels, since Resources has no modules/lessons/access-grants-style deep
 * nesting to justify that (§20: "intentionally decoupled from
 * course_lessons"). Department assignment reuses the exact same
 * whole-set-replace semantics as CourseDepartmentsPanel.tsx (no history to
 * preserve for a plain join table) — just inline here rather than a
 * separate panel, proportionate to this feature's smaller scope.
 */
export function ResourceFormModal({
  open,
  onClose,
  resource,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  resource?: ResourceResponse;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!resource;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Same "derive during render, null until touched" shape as
  // CourseDepartmentsPanel.tsx's `pendingSelection` — avoids syncing
  // fetched data into local state via an effect entirely.
  const [pendingSelection, setPendingSelection] = useState<Set<string> | null>(null);

  // Useful Link unit: which of File/External Link is selected in the UI
  // right now. `originalMode` is what the resource actually was when the
  // modal opened (null for create) — used at submit time to know whether
  // the OTHER field must be explicitly cleared (backend requires exactly
  // one of media_asset_id/external_url; switching modes must null the one
  // being abandoned). `sourceMode` itself follows the same
  // derive-during-render pattern as `pendingSelection` above.
  const originalMode: SourceMode | null = resource ? (resource.external_url ? "LINK" : "FILE") : null;
  const [pendingSourceMode, setPendingSourceMode] = useState<SourceMode | null>(null);
  const sourceMode = pendingSourceMode ?? originalMode ?? "FILE";

  const categoriesQuery = useQuery({
    queryKey: ["active-resource-categories"],
    queryFn: listActiveResourceCategories,
    enabled: open,
  });
  const allDepartments = useQuery({
    queryKey: ["all-departments"],
    queryFn: listAllDepartments,
    enabled: open,
  });
  const assignedDepartments = useQuery({
    queryKey: ["resource-departments", resource?.id],
    queryFn: () => getResourceDepartments(resource!.id),
    enabled: open && isEdit,
  });
  const assignedIds = useMemo(
    () => new Set((assignedDepartments.data ?? []).map((d) => d.id)),
    [assignedDepartments.data],
  );
  const selectedDepartments = pendingSelection ?? assignedIds;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { title: "", description: "", category_id: "", external_url: "" },
  });

  // Resets the react-hook-form fields whenever the modal opens (for a
  // different resource, or fresh for create) — `reset()` isn't a raw
  // useState setter, so this is exempt from the "avoid setState in an
  // effect" concern the file/department state below deliberately avoids
  // instead of triggering. `file`/`fileError`/`pendingSelection` don't need
  // resetting here: `handleClose` already clears them on every close path
  // (Cancel, backdrop, Escape, successful submit — Modal.tsx routes all of
  // those through it), so by the time the modal reopens they're already
  // clean.
  useEffect(() => {
    if (!open) return;
    reset(
      resource
        ? {
            title: resource.title,
            description: resource.description ?? "",
            category_id: resource.category.id,
            external_url: resource.external_url ?? "",
          }
        : { title: "", description: "", category_id: "", external_url: "" },
    );
  }, [open, resource, reset]);

  function toggleDepartment(departmentId: string) {
    const next = new Set(selectedDepartments);
    if (next.has(departmentId)) next.delete(departmentId);
    else next.add(departmentId);
    setPendingSelection(next);
  }

  function handleClose() {
    setFile(null);
    setFileError(null);
    setPendingSelection(null);
    setPendingSourceMode(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: ResourceFormValues) => {
      const base = {
        title: values.title,
        description: values.description || null,
        category_id: values.category_id,
      };

      // Useful Link unit: exactly one of media_asset_id/external_url is
      // ever included in the request. Switching modes (originalMode !==
      // sourceMode, edit only) explicitly nulls the field being abandoned —
      // the backend requires that to be explicit (admin-resources.service.ts's
      // updateResource never auto-clears it). Staying in the same mode
      // omits the untouched field entirely (undefined keys are dropped by
      // JSON.stringify), preserving the pre-existing "no new file = keep
      // the existing one" behavior exactly.
      const sourceFields: { media_asset_id?: string | null; external_url?: string | null } = {};
      if (sourceMode === "FILE") {
        // The form's onSubmit below already guarantees `file` is set
        // whenever one is actually required (create, or switching from a
        // link) — this mutation is never invoked otherwise.
        const media_asset_id = file ? (await uploadResourceFile(file)).id : undefined;
        if (media_asset_id !== undefined) sourceFields.media_asset_id = media_asset_id;
        if (isEdit && originalMode === "LINK") sourceFields.external_url = null;
      } else {
        sourceFields.external_url = values.external_url!.trim();
        if (isEdit && originalMode === "FILE") sourceFields.media_asset_id = null;
      }

      const saved = isEdit
        ? await updateResource(resource!.id, { ...base, ...sourceFields })
        : await createResource({ ...base, ...sourceFields } as CreateResourceRequest);

      await setResourceDepartments(saved.id, [...selectedDepartments]);
      return saved;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      toast.success(isEdit ? "Resource updated." : "Resource created.");
      onSuccess();
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === "media_asset_id") {
            setFileError(messages[0] ?? null);
            continue;
          }
          setError(field as keyof ResourceFormValues, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save the resource.");
    },
  });

  const departments = useMemo(() => allDepartments.data ?? [], [allDepartments.data]);

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Edit Resource" : "New Resource"} wide>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          void handleSubmit((values) => {
            if (sourceMode === "FILE") {
              // A new file is required on create, and when switching from a
              // link-backed resource to file-backed (there's no existing
              // file to fall back to in that case); editing an already
              // file-backed resource without picking a new one keeps the
              // current file, same as before this unit.
              const needsNewFile = !isEdit || originalMode === "LINK";
              if (needsNewFile && !file) {
                setFileError("A file is required.");
                return;
              }
            } else if (!values.external_url?.trim()) {
              setError("external_url", { message: "A URL is required." });
              return;
            }
            mutation.mutate(values);
          })(event)
        }
      >
        <TextField label="Title" id="r-title" error={errors.title?.message} {...register("title")} />
        <RichTextField
          label="Description"
          id="r-description"
          control={control}
          name="description"
        />
        <SelectField
          label="Category"
          id="r-category"
          error={errors.category_id?.message}
          {...register("category_id")}
        >
          <option value="">Select a category…</option>
          {categoriesQuery.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Source"
          id="r-source-mode"
          value={sourceMode}
          onChange={(event) => setPendingSourceMode(event.target.value as SourceMode)}
        >
          <option value="FILE">File</option>
          <option value="LINK">External Link</option>
        </SelectField>

        {sourceMode === "FILE" ? (
          <div>
            <label htmlFor="r-file" className="block text-sm font-medium text-slate-700">
              File
            </label>
            <div className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <UploadCloud className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <label htmlFor="r-file" className="mt-2 block text-sm text-slate-600">
                {isEdit && originalMode === "FILE" ? "Upload a replacement file (optional)" : "Upload a file"}
              </label>
              <input
                id="r-file"
                type="file"
                className="mt-2 block w-full text-sm text-slate-600"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setFileError(null);
                }}
              />
              {file && (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} ({formatBytes(file.size)})
                </p>
              )}
              {isEdit && originalMode === "FILE" && !file && (
                <p className="mt-1 text-xs text-slate-500">
                  Current file type: {resource!.file_type}
                </p>
              )}
            </div>
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
          </div>
        ) : (
          <TextField
            label="URL"
            id="r-external-url"
            type="url"
            placeholder="https://…"
            error={errors.external_url?.message}
            {...register("external_url")}
          />
        )}

        <div>
          <span className="block text-sm font-medium text-slate-700">Department Visibility</span>
          <p className="mt-0.5 text-xs text-slate-500">
            Leave every department unchecked to make this resource visible to everyone.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <CheckboxField
                key={department.id}
                id={`r-dept-${department.id}`}
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
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create resource"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
