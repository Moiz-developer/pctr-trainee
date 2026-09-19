import type {
  PublicBrandingResponse,
  SystemSettingsResponse,
  UpdateSystemSettingsRequest,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { SystemSettings } from "../../generated/prisma/client.js";
import { ValidationError } from "../../lib/errors.js";
import { BRANDING_ASSETS_BUCKET } from "../media/media.constants.js";
import { createSignedDownloadUrl } from "../media/media.storage.js";

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
    platform_name: row.platformName,
    platform_description: row.platformDescription,
    support_email: row.supportEmail,
    timezone: row.timezone,
    browser_title: row.browserTitle,
    platform_logo_media_id: row.platformLogoMediaId,
    favicon_media_id: row.faviconMediaId,
    login_logo_media_id: row.loginLogoMediaId,
    primary_color: row.primaryColor,
    accent_color: row.accentColor,
    updated_by: row.updatedBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function getRow(): Promise<SystemSettings> {
  return prisma.systemSettings.findFirstOrThrow();
}

/** A referenced logo/favicon must be an existing media asset in the branding bucket (same shape as course-lesson media validation). */
async function assertBrandingAssets(ids: Record<string, string | null | undefined>): Promise<void> {
  for (const [field, id] of Object.entries(ids)) {
    if (!id) continue;
    const media = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) {
      throw new ValidationError({ [field]: [`No media asset exists with id "${id}".`] });
    }
    if (media.bucket !== BRANDING_ASSETS_BUCKET) {
      throw new ValidationError({ [field]: ["That media asset is not a branding image."] });
    }
  }
}

/** Long enough that a logo on an open page doesn't expire mid-session; the web app refetches branding well before this. */
const BRANDING_SIGNED_URL_TTL_SECONDS = 3600;

interface PublicBrandingRow {
  platform_name: string | null;
  platform_description: string | null;
  support_email: string | null;
  browser_title: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_bucket: string | null;
  logo_path: string | null;
  favicon_bucket: string | null;
  favicon_path: string | null;
  login_logo_bucket: string | null;
  login_logo_path: string | null;
}

async function signBrandingAsset(bucket: string | null, path: string | null) {
  if (!bucket || !path) return null;
  return createSignedDownloadUrl(bucket, path, BRANDING_SIGNED_URL_TTL_SECONDS);
}

/**
 * GET /api/v1/settings/branding — PUBLIC, no auth (the login page needs it).
 * Reads through the narrow `get_public_branding()` SECURITY DEFINER function
 * (only the public branding columns — see its migration) because
 * `system_settings`/`media_assets` are RLS-gated on an authenticated user.
 * Logo/favicon URLs are short-lived signed URLs; the buckets stay private.
 */
export async function getPublicBranding(): Promise<PublicBrandingResponse> {
  const [row] = await prisma.$queryRaw<
    PublicBrandingRow[]
  >`SELECT * FROM public.get_public_branding()`;

  return {
    platform_name: row?.platform_name ?? null,
    platform_description: row?.platform_description ?? null,
    support_email: row?.support_email ?? null,
    browser_title: row?.browser_title ?? null,
    primary_color: row?.primary_color ?? null,
    accent_color: row?.accent_color ?? null,
    logo_url: await signBrandingAsset(row?.logo_bucket ?? null, row?.logo_path ?? null),
    favicon_url: await signBrandingAsset(row?.favicon_bucket ?? null, row?.favicon_path ?? null),
    login_logo_url: await signBrandingAsset(
      row?.login_logo_bucket ?? null,
      row?.login_logo_path ?? null,
    ),
  };
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
  await assertBrandingAssets({
    platform_logo_media_id: input.platform_logo_media_id,
    favicon_media_id: input.favicon_media_id,
    login_logo_media_id: input.login_logo_media_id,
  });
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
      ...(input.platform_name !== undefined ? { platformName: input.platform_name } : {}),
      ...(input.platform_description !== undefined
        ? { platformDescription: input.platform_description }
        : {}),
      ...(input.support_email !== undefined ? { supportEmail: input.support_email } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.browser_title !== undefined ? { browserTitle: input.browser_title } : {}),
      ...(input.platform_logo_media_id !== undefined
        ? { platformLogoMediaId: input.platform_logo_media_id }
        : {}),
      ...(input.favicon_media_id !== undefined ? { faviconMediaId: input.favicon_media_id } : {}),
      ...(input.login_logo_media_id !== undefined
        ? { loginLogoMediaId: input.login_logo_media_id }
        : {}),
      ...(input.primary_color !== undefined ? { primaryColor: input.primary_color } : {}),
      ...(input.accent_color !== undefined ? { accentColor: input.accent_color } : {}),
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
