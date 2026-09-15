import type {
  SystemSettingsResponse,
  UpdateSystemSettingsRequest,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { SystemSettings } from "../../generated/prisma/client.js";

/**
 * Admin Portal / System Settings (SYSTEM_PLAN.md §14.9/§16). A single-row
 * table — this file always operates on "the" row (fetched fresh per call,
 * no in-memory caching, matching this codebase's established
 * fetch-per-request convention). No create/delete: the one row is seeded
 * once by the migration itself (20260914090000_system_settings); nothing in
 * the application ever creates a second one.
 */

function toResponse(row: SystemSettings): SystemSettingsResponse {
  return {
    id: row.id,
    course_media_max_bytes: Number(row.courseMediaMaxBytes),
    course_media_mime_allowlist: row.courseMediaMimeAllowlist,
    query_attachment_max_bytes: Number(row.queryAttachmentMaxBytes),
    query_attachment_mime_allowlist: row.queryAttachmentMimeAllowlist,
    resource_file_max_bytes: Number(row.resourceFileMaxBytes),
    resource_file_mime_allowlist: row.resourceFileMimeAllowlist,
    policy_document_max_bytes: Number(row.policyDocumentMaxBytes),
    policy_document_mime_allowlist: row.policyDocumentMimeAllowlist,
    announcement_media_max_bytes: Number(row.announcementMediaMaxBytes),
    announcement_media_mime_allowlist: row.announcementMediaMimeAllowlist,
    signed_url_ttl_video_seconds: row.signedUrlTtlVideoSeconds,
    signed_url_ttl_default_seconds: row.signedUrlTtlDefaultSeconds,
    video_completion_threshold: Number(row.videoCompletionThreshold),
    updated_by: row.updatedBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function getRow(): Promise<SystemSettings> {
  return prisma.systemSettings.findFirstOrThrow();
}

/** GET /api/v1/admin/settings (permission `system.manage`). */
export async function getSystemSettings(): Promise<SystemSettingsResponse> {
  return toResponse(await getRow());
}

/**
 * PATCH /api/v1/admin/settings (permission `system.manage`) — partial
 * update of the one settings row. `updated_by` always comes from the
 * authenticated request identity, never the request body (this project's
 * established anti-impersonation convention).
 */
export async function updateSystemSettings(
  input: UpdateSystemSettingsRequest,
  updatedBy: string,
): Promise<SystemSettingsResponse> {
  const existing = await getRow();
  const updated = await prisma.systemSettings.update({
    where: { id: existing.id },
    data: {
      ...(input.course_media_max_bytes !== undefined
        ? { courseMediaMaxBytes: BigInt(input.course_media_max_bytes) }
        : {}),
      ...(input.course_media_mime_allowlist !== undefined
        ? { courseMediaMimeAllowlist: input.course_media_mime_allowlist }
        : {}),
      ...(input.query_attachment_max_bytes !== undefined
        ? { queryAttachmentMaxBytes: BigInt(input.query_attachment_max_bytes) }
        : {}),
      ...(input.query_attachment_mime_allowlist !== undefined
        ? { queryAttachmentMimeAllowlist: input.query_attachment_mime_allowlist }
        : {}),
      ...(input.resource_file_max_bytes !== undefined
        ? { resourceFileMaxBytes: BigInt(input.resource_file_max_bytes) }
        : {}),
      ...(input.resource_file_mime_allowlist !== undefined
        ? { resourceFileMimeAllowlist: input.resource_file_mime_allowlist }
        : {}),
      ...(input.policy_document_max_bytes !== undefined
        ? { policyDocumentMaxBytes: BigInt(input.policy_document_max_bytes) }
        : {}),
      ...(input.policy_document_mime_allowlist !== undefined
        ? { policyDocumentMimeAllowlist: input.policy_document_mime_allowlist }
        : {}),
      ...(input.announcement_media_max_bytes !== undefined
        ? { announcementMediaMaxBytes: BigInt(input.announcement_media_max_bytes) }
        : {}),
      ...(input.announcement_media_mime_allowlist !== undefined
        ? { announcementMediaMimeAllowlist: input.announcement_media_mime_allowlist }
        : {}),
      ...(input.signed_url_ttl_video_seconds !== undefined
        ? { signedUrlTtlVideoSeconds: input.signed_url_ttl_video_seconds }
        : {}),
      ...(input.signed_url_ttl_default_seconds !== undefined
        ? { signedUrlTtlDefaultSeconds: input.signed_url_ttl_default_seconds }
        : {}),
      ...(input.video_completion_threshold !== undefined
        ? { videoCompletionThreshold: input.video_completion_threshold }
        : {}),
      updatedBy,
    },
  });
  return toResponse(updated);
}

/** GET /api/v1/settings/video-completion-threshold — trainee-facing, auth-only, no permission gate. */
export async function getVideoCompletionThreshold(): Promise<number> {
  const row = await getRow();
  return Number(row.videoCompletionThreshold);
}

/**
 * Internal cross-module read for media.service.ts — the DB-backed
 * replacement for the bucket-config half of the old static
 * media.constants.ts exports (bucket NAMES themselves stay hardcoded
 * constants; only MIME allowlist / max bytes / TTLs moved here).
 */
export async function getMediaSettings(): Promise<{
  courseMediaMaxBytes: number;
  courseMediaMimeAllowlist: ReadonlySet<string>;
  queryAttachmentMaxBytes: number;
  queryAttachmentMimeAllowlist: ReadonlySet<string>;
  resourceFileMaxBytes: number;
  resourceFileMimeAllowlist: ReadonlySet<string>;
  policyDocumentMaxBytes: number;
  policyDocumentMimeAllowlist: ReadonlySet<string>;
  announcementMediaMaxBytes: number;
  announcementMediaMimeAllowlist: ReadonlySet<string>;
  signedUrlTtlVideoSeconds: number;
  signedUrlTtlDefaultSeconds: number;
}> {
  const row = await getRow();
  return {
    courseMediaMaxBytes: Number(row.courseMediaMaxBytes),
    courseMediaMimeAllowlist: new Set(row.courseMediaMimeAllowlist),
    queryAttachmentMaxBytes: Number(row.queryAttachmentMaxBytes),
    queryAttachmentMimeAllowlist: new Set(row.queryAttachmentMimeAllowlist),
    resourceFileMaxBytes: Number(row.resourceFileMaxBytes),
    resourceFileMimeAllowlist: new Set(row.resourceFileMimeAllowlist),
    policyDocumentMaxBytes: Number(row.policyDocumentMaxBytes),
    policyDocumentMimeAllowlist: new Set(row.policyDocumentMimeAllowlist),
    announcementMediaMaxBytes: Number(row.announcementMediaMaxBytes),
    announcementMediaMimeAllowlist: new Set(row.announcementMediaMimeAllowlist),
    signedUrlTtlVideoSeconds: row.signedUrlTtlVideoSeconds,
    signedUrlTtlDefaultSeconds: row.signedUrlTtlDefaultSeconds,
  };
}
