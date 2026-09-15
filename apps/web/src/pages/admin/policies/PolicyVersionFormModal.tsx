import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import type { PolicyVersionResponse } from "@internal-training/shared";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { ApiClientError } from "../../../services/api/client";
import { uploadPolicyDocument } from "../../../services/api/media";
import { createPolicyVersion, updatePolicyVersion } from "../../../services/api/adminPolicies";

// Local form shape — `media_asset_id` isn't a registered field (the file is
// tracked as local `File` state and resolved to an id at submit time, the
// same shape ResourceFormModal.tsx already established). At least one of
// file/content is required on CREATE (validated in the submit handler, not
// the resolver, mirroring ResourceFormModal's own file-required check) —
// EDIT leaves both optional, since an edit may only touch version_label/
// effective_date.
const versionFormSchema = z.object({
  version_label: z.string().min(1),
  effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effective date must be an ISO date (YYYY-MM-DD)."),
  content: z.string().optional(),
});
type VersionFormValues = z.infer<typeof versionFormSchema>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create/edit a policy version — version label, effective date, and either
 * an uploaded document or inline content (SYSTEM_PLAN.md §14.8, Phase 5.2,
 * permission `policy.manage`). "Upload/replace documents" is this same
 * form's file field on an edit — never a separate flow. Never activates:
 * activation is always the separate, explicit action on
 * AdminPolicyDetailPage.tsx (permission `policy.version.activate`).
 */
export function PolicyVersionFormModal({
  open,
  onClose,
  policyId,
  version,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  policyId: string;
  version?: PolicyVersionResponse;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!version;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<VersionFormValues>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: { version_label: "", effective_date: "", content: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      version
        ? {
            version_label: version.version_label,
            effective_date: version.effective_date,
            content: version.content ?? "",
          }
        : { version_label: "", effective_date: "", content: "" },
    );
  }, [open, version, reset]);

  function handleClose() {
    setFile(null);
    setFileError(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async (values: VersionFormValues) => {
      const media_asset_id = file ? (await uploadPolicyDocument(file)).id : undefined;
      const content = values.content || undefined;

      return isEdit
        ? updatePolicyVersion(policyId, version!.id, {
            version_label: values.version_label,
            effective_date: values.effective_date,
            ...(media_asset_id !== undefined ? { media_asset_id } : {}),
            content,
          })
        : createPolicyVersion(policyId, {
            version_label: values.version_label,
            effective_date: values.effective_date,
            media_asset_id,
            content,
          });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-policy", policyId] });
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
          setError(field as keyof VersionFormValues, { message: messages[0] });
        }
      }
    },
  });

  const submitError =
    mutation.error instanceof ApiClientError && !mutation.error.fields
      ? mutation.error.message
      : null;

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Edit Version" : "New Version"} wide>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          void handleSubmit((values) => {
            if (!isEdit && !file && !values.content?.trim()) {
              setFileError("Provide a document or inline content.");
              return;
            }
            mutation.mutate(values);
          })(event)
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Version Label"
            id="v-label"
            error={errors.version_label?.message}
            {...register("version_label")}
            placeholder="e.g. 1.1"
          />
          <TextField
            label="Effective Date"
            id="v-effective-date"
            type="date"
            error={errors.effective_date?.message}
            {...register("effective_date")}
          />
        </div>

        <div>
          <label htmlFor="v-file" className="block text-sm font-medium text-slate-700">
            Document
          </label>
          <div className="mt-1 rounded-lg border border-dashed border-slate-300 p-4 text-center">
            <UploadCloud className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <label htmlFor="v-file" className="mt-2 block text-sm text-slate-600">
              {isEdit ? "Upload a replacement document (optional)" : "Upload a document (optional)"}
            </label>
            <input
              id="v-file"
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
          </div>
        </div>

        <TextAreaField
          label="Inline Content (optional if a document is attached)"
          id="v-content"
          error={errors.content?.message}
          {...register("content")}
          placeholder="Plain text content, if this version isn't a document upload…"
        />

        {fileError && <p className="text-sm text-red-600">{fileError}</p>}
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create version"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
