import {
  apiSuccessSchema,
  createMediaUploadUrlRequestSchema,
  mediaAccessUrlSuccessResponseSchema,
  mediaAssetSuccessResponseSchema,
  mediaUploadUrlResponseSchema,
  type MediaAccessUrlResponse,
  type MediaAssetResponse,
  type MediaPurpose,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const uploadUrlEnvelope = apiSuccessSchema(mediaUploadUrlResponseSchema);

/**
 * Full client-side upload flow (SYSTEM_PLAN.md §16): request a signed
 * upload slot from our API, PUT the bytes straight to Supabase Storage
 * (never through our server), then confirm. The confirm step, not this
 * function, is what actually creates the `media_assets` row. Generalized
 * over `purpose` (Phase 6.2) so `uploadCourseMedia`/`uploadQueryAttachment`
 * below share one implementation rather than duplicating this flow.
 */
// Browsers often report an empty `file.type` for Office documents (and
// sometimes PDFs) when the OS has no MIME association for the extension; the
// API allowlist rejects the resulting "application/octet-stream".
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

async function uploadMedia(file: File, purpose: MediaPurpose): Promise<MediaAssetResponse> {
  const uploadReq = createMediaUploadUrlRequestSchema.parse({
    purpose,
    filename: file.name,
    mime_type: resolveMimeType(file),
    size_bytes: file.size,
  });

  const uploadUrlBody = await apiFetch<unknown>("/media/upload-url", {
    method: "POST",
    body: JSON.stringify(uploadReq),
  });
  const { upload_url, storage_path } = uploadUrlEnvelope.parse(uploadUrlBody).data;

  // Direct-to-Storage PUT — deliberately not apiFetch: this goes to Supabase's
  // signed URL, not our API, and must not carry our Authorization header.
  const putResponse = await fetch(upload_url, {
    method: "PUT",
    headers: { "content-type": uploadReq.mime_type },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error("Uploading the file to storage failed. Please try again.");
  }

  const confirmBody = await apiFetch<unknown>("/media/confirm", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      storage_path,
      mime_type: uploadReq.mime_type,
      size_bytes: uploadReq.size_bytes,
      original_filename: file.name,
    }),
  });
  return mediaAssetSuccessResponseSchema.parse(confirmBody).data;
}

export async function uploadCourseMedia(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "course-media");
}

/** A trainee's own ticket attachment (Phase 6.2, SYSTEM_PLAN.md §16 `query-attachments` bucket). */
export async function uploadQueryAttachment(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "query-attachments");
}

/** An admin-authored Resource Library file (Phase 5.1, SYSTEM_PLAN.md §16 `resource-files` bucket, permission `resource.manage`). */
export async function uploadResourceFile(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "resource-files");
}

/** An admin-authored Policy & Procedures document (Phase 5.2, SYSTEM_PLAN.md §16 `policy-documents` bucket, permission `policy.manage`). */
export async function uploadPolicyDocument(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "policy-documents");
}

/** An admin-authored announcement's banner image or attachment (Phase 5.3.2, SYSTEM_PLAN.md §16 `announcement-media` bucket, permission `announcement.manage`). */
export async function uploadAnnouncementMedia(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "announcement-media");
}

/** An admin-managed branding image — platform logo, favicon or login logo (Admin Settings, permission `system.manage`, `branding-assets` bucket). */
export async function uploadBrandingAsset(file: File): Promise<MediaAssetResponse> {
  return uploadMedia(file, "branding-assets");
}

export async function getMediaAccessUrl(mediaAssetId: string): Promise<MediaAccessUrlResponse> {
  const body = await apiFetch<unknown>(`/media/${mediaAssetId}/access-url`);
  return mediaAccessUrlSuccessResponseSchema.parse(body).data;
}
