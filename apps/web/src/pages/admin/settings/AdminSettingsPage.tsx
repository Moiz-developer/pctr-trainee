import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Settings as SettingsIcon } from "lucide-react";
import type { SystemSettingsResponse, UpdateSystemSettingsRequest } from "@internal-training/shared";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { TextField, TextAreaField } from "../../../components/ui/FormField";
import { RemoteDataView } from "../../../components/shared/RemoteDataView";
import { useToast } from "../../../components/ui/Toast";
import { ApiClientError } from "../../../services/api/client";
import { getSystemSettings, updateSystemSettings } from "../../../services/api/adminSettings";

/**
 * Admin Portal / System Settings (SYSTEM_PLAN.md §14.9/§16, permission
 * `system.manage`). A single-object settings form, not a list+modal CRUD
 * page (there is exactly one settings row, never several) — the closest
 * existing shape to mirror is a plain edit form like PolicyVersionFormModal.tsx's
 * own local-form-schema pattern: the form's fields (MB instead of raw
 * bytes, a newline-per-line MIME textarea instead of an array, a 0-100%
 * instead of a 0-1 fraction) are friendlier than the API's own shape, so a
 * LOCAL zod schema (string fields only, since every input here is a text
 * field) is used for react-hook-form/validation, converted to/from
 * `UpdateSystemSettingsRequest` only in `reset()`/`onSubmit`, not the wire
 * format itself.
 */

const settingsFormSchema = z.object({
  course_media_max_mb: z.string().min(1),
  course_media_mime_allowlist: z.string().min(1),
  query_attachment_max_mb: z.string().min(1),
  query_attachment_mime_allowlist: z.string().min(1),
  resource_file_max_mb: z.string().min(1),
  resource_file_mime_allowlist: z.string().min(1),
  policy_document_max_mb: z.string().min(1),
  policy_document_mime_allowlist: z.string().min(1),
  announcement_media_max_mb: z.string().min(1),
  announcement_media_mime_allowlist: z.string().min(1),
  signed_url_ttl_video_seconds: z.string().min(1),
  signed_url_ttl_default_seconds: z.string().min(1),
  video_completion_threshold_pct: z.string().min(1),
});
type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const BYTES_PER_MB = 1024 * 1024;

function bytesToMbText(bytes: number): string {
  return String(Math.round(bytes / BYTES_PER_MB));
}

function mimeListToText(list: string[]): string {
  return list.join("\n");
}

/** Newline- or comma-separated MIME types, trimmed, empties dropped. */
function parseMimeList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toFormValues(settings: SystemSettingsResponse): SettingsFormValues {
  return {
    course_media_max_mb: bytesToMbText(settings.course_media_max_bytes),
    course_media_mime_allowlist: mimeListToText(settings.course_media_mime_allowlist),
    query_attachment_max_mb: bytesToMbText(settings.query_attachment_max_bytes),
    query_attachment_mime_allowlist: mimeListToText(settings.query_attachment_mime_allowlist),
    resource_file_max_mb: bytesToMbText(settings.resource_file_max_bytes),
    resource_file_mime_allowlist: mimeListToText(settings.resource_file_mime_allowlist),
    policy_document_max_mb: bytesToMbText(settings.policy_document_max_bytes),
    policy_document_mime_allowlist: mimeListToText(settings.policy_document_mime_allowlist),
    announcement_media_max_mb: bytesToMbText(settings.announcement_media_max_bytes),
    announcement_media_mime_allowlist: mimeListToText(settings.announcement_media_mime_allowlist),
    signed_url_ttl_video_seconds: String(settings.signed_url_ttl_video_seconds),
    signed_url_ttl_default_seconds: String(settings.signed_url_ttl_default_seconds),
    video_completion_threshold_pct: String(Math.round(settings.video_completion_threshold * 100)),
  };
}

function toUpdateRequest(values: SettingsFormValues): UpdateSystemSettingsRequest {
  return {
    course_media_max_bytes: Math.round(Number(values.course_media_max_mb) * BYTES_PER_MB),
    course_media_mime_allowlist: parseMimeList(values.course_media_mime_allowlist),
    query_attachment_max_bytes: Math.round(Number(values.query_attachment_max_mb) * BYTES_PER_MB),
    query_attachment_mime_allowlist: parseMimeList(values.query_attachment_mime_allowlist),
    resource_file_max_bytes: Math.round(Number(values.resource_file_max_mb) * BYTES_PER_MB),
    resource_file_mime_allowlist: parseMimeList(values.resource_file_mime_allowlist),
    policy_document_max_bytes: Math.round(Number(values.policy_document_max_mb) * BYTES_PER_MB),
    policy_document_mime_allowlist: parseMimeList(values.policy_document_mime_allowlist),
    announcement_media_max_bytes: Math.round(
      Number(values.announcement_media_max_mb) * BYTES_PER_MB,
    ),
    announcement_media_mime_allowlist: parseMimeList(values.announcement_media_mime_allowlist),
    signed_url_ttl_video_seconds: Number(values.signed_url_ttl_video_seconds),
    signed_url_ttl_default_seconds: Number(values.signed_url_ttl_default_seconds),
    video_completion_threshold: Number(values.video_completion_threshold_pct) / 100,
  };
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: getSystemSettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
  });

  useEffect(() => {
    if (!query.data) return;
    reset(toFormValues(query.data));
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: SettingsFormValues) => updateSystemSettings(toUpdateRequest(values)),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      reset(toFormValues(result));
      toast.success("Settings saved.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save settings.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900">System Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Media upload limits, signed-URL expiry, and the video completion threshold.
          </p>
        </div>
      </div>

      <RemoteDataView
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
      >
        {() => (
          <form
            className="space-y-6"
            onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
          >
            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Course Media</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Max Size (MB)"
                  id="course-media-max-mb"
                  type="number"
                  error={errors.course_media_max_mb?.message}
                  {...register("course_media_max_mb")}
                />
                <TextAreaField
                  label="Allowed MIME Types (one per line)"
                  id="course-media-mime"
                  error={errors.course_media_mime_allowlist?.message}
                  {...register("course_media_mime_allowlist")}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Query Attachments</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Max Size (MB)"
                  id="query-attachment-max-mb"
                  type="number"
                  error={errors.query_attachment_max_mb?.message}
                  {...register("query_attachment_max_mb")}
                />
                <TextAreaField
                  label="Allowed MIME Types (one per line)"
                  id="query-attachment-mime"
                  error={errors.query_attachment_mime_allowlist?.message}
                  {...register("query_attachment_mime_allowlist")}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Resource Files</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Max Size (MB)"
                  id="resource-file-max-mb"
                  type="number"
                  error={errors.resource_file_max_mb?.message}
                  {...register("resource_file_max_mb")}
                />
                <TextAreaField
                  label="Allowed MIME Types (one per line)"
                  id="resource-file-mime"
                  error={errors.resource_file_mime_allowlist?.message}
                  {...register("resource_file_mime_allowlist")}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Policy Documents</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Max Size (MB)"
                  id="policy-document-max-mb"
                  type="number"
                  error={errors.policy_document_max_mb?.message}
                  {...register("policy_document_max_mb")}
                />
                <TextAreaField
                  label="Allowed MIME Types (one per line)"
                  id="policy-document-mime"
                  error={errors.policy_document_mime_allowlist?.message}
                  {...register("policy_document_mime_allowlist")}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Announcement Media</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Max Size (MB)"
                  id="announcement-media-max-mb"
                  type="number"
                  error={errors.announcement_media_max_mb?.message}
                  {...register("announcement_media_max_mb")}
                />
                <TextAreaField
                  label="Allowed MIME Types (one per line)"
                  id="announcement-media-mime"
                  error={errors.announcement_media_mime_allowlist?.message}
                  {...register("announcement_media_mime_allowlist")}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">Signed URLs & Video Completion</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  label="Video Signed URL TTL (seconds)"
                  id="ttl-video"
                  type="number"
                  error={errors.signed_url_ttl_video_seconds?.message}
                  {...register("signed_url_ttl_video_seconds")}
                />
                <TextField
                  label="Default Signed URL TTL (seconds)"
                  id="ttl-default"
                  type="number"
                  error={errors.signed_url_ttl_default_seconds?.message}
                  {...register("signed_url_ttl_default_seconds")}
                />
                <TextField
                  label="Video Completion Threshold (%)"
                  id="video-completion-threshold"
                  type="number"
                  error={errors.video_completion_threshold_pct?.message}
                  {...register("video_completion_threshold_pct")}
                />
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={isSubmitting || mutation.isPending}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {mutation.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </form>
        )}
      </RemoteDataView>
    </div>
  );
}
