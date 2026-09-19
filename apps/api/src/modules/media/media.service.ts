import { randomUUID } from "node:crypto";
import type {
  CreateMediaUploadUrlRequest,
  ConfirmMediaUploadRequest,
  MediaPurpose,
  MediaUploadUrlResponse,
  MediaAssetResponse,
  MediaAccessUrlResponse,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { MediaAsset } from "../../generated/prisma/client.js";
import {
  effectiveCourseAccessFilter,
  effectiveResourceVisibilityFilter,
  effectiveAnnouncementVisibilityFilter,
  effectivePolicyVisibilityFilter,
} from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  COURSE_MEDIA_BUCKET,
  QUERY_ATTACHMENTS_BUCKET,
  RESOURCE_FILES_BUCKET,
  POLICY_DOCUMENTS_BUCKET,
  ANNOUNCEMENT_MEDIA_BUCKET,
  BRANDING_ASSETS_BUCKET,
  BRANDING_ASSETS_MAX_BYTES,
  BRANDING_ASSETS_MIME_ALLOWLIST,
} from "./media.constants.js";
import { getMediaSettings } from "../settings/settings.service.js";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  ensureBucket,
  getObjectInfo,
} from "./media.storage.js";

// A storage path this API generated: `<uuid>/<safe-filename>`. Confirm
// rejects anything else — prevents path traversal and confirming an
// arbitrary object the caller didn't upload through this flow.
const STORAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

/**
 * `purpose` -> bucket/allowlist/limit (SYSTEM_PLAN.md §16: "purpose maps
 * 1:1 to a bucket name"). Phase 6.2 adds `query-attachments` alongside the
 * existing `course-media` — same generic resolution, no per-purpose branch
 * duplicated across the two functions below. Bucket NAMES stay the
 * hardcoded `media.constants.ts` values (never named as configurable);
 * `maxBytes`/`mimeAllowlist` now come from the caller's own
 * `getMediaSettings()` read (Admin Portal / System Settings unit) instead
 * of a second hardcoded constant per purpose — `settings` is fetched once
 * per request by the caller and threaded in here, rather than this
 * function re-fetching it itself.
 */
function resolvePurposeConfig(
  purpose: MediaPurpose,
  settings: Awaited<ReturnType<typeof getMediaSettings>>,
): {
  bucket: string;
  maxBytes: number;
  mimeAllowlist: ReadonlySet<string>;
} {
  if (purpose === "query-attachments") {
    return {
      bucket: QUERY_ATTACHMENTS_BUCKET,
      maxBytes: settings.queryAttachmentMaxBytes,
      mimeAllowlist: settings.queryAttachmentMimeAllowlist,
    };
  }
  if (purpose === "resource-files") {
    return {
      bucket: RESOURCE_FILES_BUCKET,
      maxBytes: settings.resourceFileMaxBytes,
      mimeAllowlist: settings.resourceFileMimeAllowlist,
    };
  }
  if (purpose === "policy-documents") {
    return {
      bucket: POLICY_DOCUMENTS_BUCKET,
      maxBytes: settings.policyDocumentMaxBytes,
      mimeAllowlist: settings.policyDocumentMimeAllowlist,
    };
  }
  if (purpose === "announcement-media") {
    return {
      bucket: ANNOUNCEMENT_MEDIA_BUCKET,
      maxBytes: settings.announcementMediaMaxBytes,
      mimeAllowlist: settings.announcementMediaMimeAllowlist,
    };
  }
  if (purpose === "branding-assets") {
    return {
      bucket: BRANDING_ASSETS_BUCKET,
      maxBytes: BRANDING_ASSETS_MAX_BYTES,
      mimeAllowlist: BRANDING_ASSETS_MIME_ALLOWLIST,
    };
  }
  return {
    bucket: COURSE_MEDIA_BUCKET,
    maxBytes: settings.courseMediaMaxBytes,
    mimeAllowlist: settings.courseMediaMimeAllowlist,
  };
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : "file";
}

function toResponse(asset: MediaAsset): MediaAssetResponse {
  return {
    id: asset.id,
    original_filename: asset.originalFilename,
    mime_type: asset.mimeType,
    size_bytes: Number(asset.sizeBytes),
    checksum: asset.checksum,
    uploaded_by: asset.uploadedBy,
    created_at: asset.createdAt.toISOString(),
  };
}

/**
 * POST /api/v1/media/upload-url (SYSTEM_PLAN.md §16 steps 1–3; permission
 * is purpose-specific — `course.content.manage` for `course-media`,
 * authenticated-self for `query-attachments` — enforced at the route, see
 * media.routes.ts). Validates the declared MIME/size against the resolved
 * purpose's allowlist/limit, computes the bucket + path server-side (never
 * client-supplied), and returns a short-lived signed upload URL. Does not
 * create a `media_assets` row yet — that happens on `confirm` after the
 * object is verified to exist (the plan's "creates it on confirmed-upload
 * callback" variant).
 */
export async function createMediaUploadUrl(
  input: CreateMediaUploadUrlRequest,
): Promise<MediaUploadUrlResponse> {
  const settings = await getMediaSettings();
  const { bucket, maxBytes, mimeAllowlist } = resolvePurposeConfig(input.purpose, settings);

  if (!mimeAllowlist.has(input.mime_type)) {
    throw new ValidationError({
      mime_type: [`"${input.mime_type}" is not an allowed ${input.purpose} content type.`],
    });
  }
  if (input.size_bytes > maxBytes) {
    throw new ValidationError({
      size_bytes: [`File exceeds the ${maxBytes}-byte ${input.purpose} size limit.`],
    });
  }

  await ensureBucket(bucket);

  const storagePath = `${randomUUID()}/${sanitizeFilename(input.filename)}`;
  const uploadUrl = await createSignedUploadUrl(bucket, storagePath);

  return { upload_url: uploadUrl, storage_path: storagePath };
}

/**
 * POST /api/v1/media/confirm (SYSTEM_PLAN.md §16 step 5; permission
 * purpose-specific, see createMediaUploadUrl above). Verifies the uploaded
 * object exists, re-checks its real size / content-type against the
 * resolved purpose's allowlist (defence against a client that requested a
 * small-PDF slot then uploaded something else), and creates the finalized
 * `media_assets` row. Idempotent on (bucket, storage_path).
 */
export async function confirmMediaUpload(
  input: ConfirmMediaUploadRequest,
  uploaderId: string,
): Promise<MediaAssetResponse> {
  const settings = await getMediaSettings();
  const { bucket, maxBytes, mimeAllowlist } = resolvePurposeConfig(input.purpose, settings);

  if (!STORAGE_PATH_RE.test(input.storage_path)) {
    throw new ValidationError({ storage_path: ["Malformed storage path."] });
  }
  if (!mimeAllowlist.has(input.mime_type)) {
    throw new ValidationError({
      mime_type: [`"${input.mime_type}" is not an allowed ${input.purpose} content type.`],
    });
  }
  if (input.size_bytes > maxBytes) {
    throw new ValidationError({ size_bytes: [`File exceeds the ${input.purpose} size limit.`] });
  }

  const existing = await prisma.mediaAsset.findUnique({
    where: { bucket_storagePath: { bucket, storagePath: input.storage_path } },
  });
  if (existing) {
    return toResponse(existing);
  }

  const info = await getObjectInfo(bucket, input.storage_path);
  if (!info) {
    throw new NotFoundError(
      "No uploaded object was found at that path — upload the file to the signed URL before confirming.",
    );
  }
  if (info.size > maxBytes) {
    throw new ValidationError({
      size_bytes: [`The uploaded object exceeds the ${input.purpose} size limit.`],
    });
  }
  if (info.contentType !== "application/octet-stream" && !mimeAllowlist.has(info.contentType)) {
    throw new ValidationError({
      mime_type: [`The uploaded object's content type "${info.contentType}" is not allowed.`],
    });
  }

  const created = await prisma.mediaAsset.create({
    data: {
      bucket,
      storagePath: input.storage_path,
      originalFilename: sanitizeFilename(input.original_filename),
      mimeType: input.mime_type,
      sizeBytes: BigInt(info.size),
      checksum: input.checksum ?? null,
      uploadedBy: uploaderId,
    },
  });
  return toResponse(created);
}

/**
 * GET /api/v1/media/:id/access-url (SYSTEM_PLAN.md §16 read flow / §26).
 * Authenticated user only — NO permission code by default; a signed URL is
 * issued only when the caller can reach this asset through a path they're
 * legitimately authorized for: a PUBLISHED course's active lesson they
 * have effective access to, a `query_attachments` row on a query they own
 * (Phase 6.4), a PUBLISHED, department-visible `resources` row's attached
 * file (Phase 5.1), the currently ACTIVE `policy_versions` row's attached
 * document (Phase 5.2), a PUBLISHED, department-visible `announcements`
 * row's attachment/image (Phase 5.3.3), OR — the exceptions that ARE
 * permission-gated — any query attachment at all for a `query.manage`
 * holder managing that ticket (Phase 6.7), any resource file at all for a
 * `resource.manage` holder managing the Resource Library (Phase 5.1), any
 * policy version's document at all (including archived history) for a
 * `policy.manage`/`policy.version.activate` holder (Phase 5.2, §23: "admins
 * can browse full history including archived versions for audit
 * purposes"), or any announcement's attachment/image at all for an
 * `announcement.manage`/`announcement.publish` holder (Phase 5.3.2)
 * managing the announcement regardless of its status/visibility.
 *
 * The lesson path is a single query built on `effectiveCourseAccessFilter`
 * from authorization/access.service.ts — the exact predicate
 * `canAccessCourse()` is composed from — so there is no second copy of that
 * access rule (Unit 2.6/2.7). The resource and announcement paths are the
 * same shape, built on `effectiveResourceVisibilityFilter`/
 * `effectiveAnnouncementVisibilityFilter` (the exact predicates
 * `canViewResource()`/`canViewAnnouncement()` are composed from). The
 * policy path needs no equivalent visibility-filter helper: there is no
 * department-scoping for policies in this phase (§14.8 defines none), so
 * "is the currently active version" is itself the complete non-admin
 * condition. The course-thumbnail path (Course Catalogue thumbnail
 * rendering unit) reuses the exact same `effectiveCourseAccessFilter`
 * predicate as the lesson path above — mirrors the `media_assets_select`
 * RLS policy's own thumbnail clause (migration `20260911110656_enable_rls`,
 * added at the same time as the lesson clause but never wired up on the API
 * side until now) byte-for-byte, so this was a pre-existing DB-level
 * allowance the API simply hadn't caught up to yet — not a new access rule.
 * The query-attachment path reuses the exact self-ownership
 * shape already established by queries.service.ts
 * (`query.user_id = caller`), and the admin paths reuse the exact
 * `query.manage`/`resource.manage`/`policy.manage`/`policy.version.activate`
 * permission checks already used for every other admin action on those
 * features — none of this is a new authorization rule invented here. The
 * media asset is never named in the response; only a short-lived signed URL
 * and its expiry (§16: "No permanent/public link ever exists").
 */
export async function getMediaAccessUrl(
  userId: string,
  mediaAssetId: string,
  permissions: readonly string[] = [],
): Promise<MediaAccessUrlResponse> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media) {
    // Phase 2H: RLS's own media_assets_select policy may have hidden this
    // row because the caller has no reachable path to it yet — that still
    // needs the "reachable" check below to produce its usual 403, not a 404
    // (SYSTEM_PLAN.md §31 / Unit 2.7 precedent, see below). `media_asset_exists`
    // returns only a boolean via SECURITY DEFINER, never row content.
    const [row] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.media_asset_exists(${mediaAssetId}::uuid) AS exists`;
    if (!row?.exists) {
      throw new NotFoundError(`No media asset exists with id "${mediaAssetId}".`);
    }
    throw new ForbiddenError("You do not have access to this media.");
  }

  const canManageQueries = permissions.includes("query.manage");
  const canManageResources = permissions.includes("resource.manage");
  const canManageCourseContent = permissions.includes("course.content.manage");

  const reachableViaLesson = await prisma.courseLesson.findFirst({
    where: {
      mediaAssetId,
      isActive: true,
      module: {
        isActive: true,
        course: {
          // A course.content.manage holder may view any lesson's media
          // regardless of the course's publish status or the caller's own
          // department/grant-based access (mirrors the course-thumbnail
          // branch below); everyone else only a PUBLISHED course they have
          // effective access to.
          ...(canManageCourseContent
            ? {}
            : { status: "PUBLISHED", ...effectiveCourseAccessFilter(userId) }),
        },
      },
    },
    select: { id: true },
  });

  const reachableViaQuery = reachableViaLesson
    ? null
    : await prisma.queryAttachment.findFirst({
        where: {
          mediaAssetId,
          // A query.manage holder may view any query's attachment
          // (Phase 6.7); everyone else only their own query's.
          ...(canManageQueries ? {} : { queryMessage: { query: { userId } } }),
        },
        select: { queryMessageId: true },
      });

  const reachableViaResource =
    reachableViaLesson || reachableViaQuery
      ? null
      : await prisma.resource.findFirst({
          where: {
            mediaAssetId,
            // A resource.manage holder may view any resource's file
            // (Phase 5.1, managing the whole library); everyone else only a
            // PUBLISHED, department-visible one.
            ...(canManageResources
              ? {}
              : { status: "PUBLISHED", ...effectiveResourceVisibilityFilter(userId) }),
          },
          select: { id: true },
        });

  const canManagePolicies =
    permissions.includes("policy.manage") || permissions.includes("policy.version.activate");

  const reachableViaPolicyVersion =
    reachableViaLesson || reachableViaQuery || reachableViaResource
      ? null
      : await prisma.policyVersion.findFirst({
          where: {
            mediaAssetId,
            // policy.manage/policy.version.activate holders may view any
            // version's document, including archived history (§23);
            // everyone else only the currently active one WHOSE effective
            // date has arrived — mirrors policies.service.ts's own
            // `withActiveVersion` gate exactly, so a trainer can't
            // view/download a document via this route before its stated
            // effective date even though the version is already marked
            // active (effective-date enforcement gap fix) — AND whose
            // parent policy is department-visible to this caller
            // (consistent granular access control unit, §7/§9: same
            // `effectivePolicyVisibilityFilter` predicate `canViewPolicy()`
            // is composed from, mirroring the resource/announcement
            // branches' identical use of their own visibility filters).
            ...(canManagePolicies
              ? {}
              : {
                  isActive: true,
                  effectiveDate: { lte: new Date() },
                  policy: effectivePolicyVisibilityFilter(userId),
                }),
          },
          select: { id: true },
        });

  // Phase 5.3.2 added the admin path (announcement.manage/
  // announcement.publish holder previewing any announcement's attachment/
  // image while managing it — covers a DIFFERENT admin than the uploader,
  // since the self-upload path above already covers previewing one's own
  // just-uploaded file). Phase 5.3.3 adds the trainee path: a PUBLISHED,
  // department-visible announcement's attachment/image, same
  // `effectiveAnnouncementVisibilityFilter` predicate `canViewAnnouncement()`
  // is built from, mirroring the resource/policy-version trainee branches
  // exactly.
  const canManageAnnouncements =
    permissions.includes("announcement.manage") || permissions.includes("announcement.publish");

  const reachableViaAnnouncement =
    reachableViaLesson || reachableViaQuery || reachableViaResource || reachableViaPolicyVersion
      ? null
      : await prisma.announcement.findFirst({
          where: {
            OR: [{ attachmentMediaId: mediaAssetId }, { imageMediaId: mediaAssetId }],
            ...(canManageAnnouncements
              ? {}
              : { status: "PUBLISHED", ...effectiveAnnouncementVisibilityFilter(userId) }),
          },
          select: { id: true },
        });

  const reachableViaCourseThumbnail =
    reachableViaLesson ||
    reachableViaQuery ||
    reachableViaResource ||
    reachableViaPolicyVersion ||
    reachableViaAnnouncement
      ? null
      : await prisma.course.findFirst({
          where: {
            thumbnailMediaId: mediaAssetId,
            // course.content.manage holder may preview any course's
            // thumbnail (e.g. before it's published); everyone else only a
            // PUBLISHED course they have effective access to — the exact
            // predicate the catalogue itself is filtered by.
            ...(permissions.includes("course.content.manage")
              ? {}
              : { status: "PUBLISHED", ...effectiveCourseAccessFilter(userId) }),
          },
          select: { id: true },
        });

  if (
    !reachableViaLesson &&
    !reachableViaQuery &&
    !reachableViaResource &&
    !reachableViaPolicyVersion &&
    !reachableViaAnnouncement &&
    !reachableViaCourseThumbnail
  ) {
    // The asset exists but the caller cannot legitimately view it through
    // any path they're authorized for. 403 (not 404) — the asset genuinely
    // exists; SYSTEM_PLAN.md §31 / Unit 2.7 precedent.
    throw new ForbiddenError("You do not have access to this media.");
  }

  const settings = await getMediaSettings();
  const ttl = media.mimeType.startsWith("video/")
    ? settings.signedUrlTtlVideoSeconds
    : settings.signedUrlTtlDefaultSeconds;

  const signedUrl = await createSignedDownloadUrl(media.bucket, media.storagePath, ttl);
  if (!signedUrl) {
    throw new NotFoundError("The media object could not be found in storage.");
  }

  const expiresAt = new Date(Date.now() + ttl * 1000);
  return { url: signedUrl, expires_in: ttl, expires_at: expiresAt.toISOString() };
}
