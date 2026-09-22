import type {
  ResourceResponse,
  CreateResourceRequest,
  UpdateResourceRequest,
  ListAdminResourcesQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Resource } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { RESOURCE_FILES_BUCKET } from "../media/media.constants.js";

/**
 * Admin Resource Library management (SYSTEM_PLAN.md §14.5/§20/§26, Phase
 * 5.1, permission `resource.manage`). Every resource, not visibility-
 * filtered — `resource.manage` means "sees/manages all" per this feature's
 * own RLS (`resources_select`'s unconditional `has_permission('resource.manage')`
 * branch, `20260913090000_resources/migration.sql`), the same shape as
 * `query.manage` for Queries. No separate architecture: reuses the exact
 * `media_assets`/signed-URL flow already built for course-media and query
 * attachments (see media.service.ts's purpose-aware upload/confirm).
 */

type ResourceWithCategory = Resource & {
  category: { id: string; name: string };
  resourceDepartments: { department: { id: string; name: string } }[];
};

const withCategory = {
  include: {
    category: { select: { id: true, name: true } },
    // Department visibility in the Trainer Portal UI unit: `ResourceResponse`
    // is shared between this admin service and the trainee-facing one
    // (resources.service.ts), so both must populate `departments` — a plain
    // scalar join, not a second round trip (Prisma batches it into the same
    // query). Read-only display of the same `resource_departments` data
    // `effectiveResourceVisibilityFilter` already treats as authoritative.
    resourceDepartments: { select: { department: { select: { id: true, name: true } } } },
  },
} as const;

/**
 * Fixed `file_type` sentinel for a URL-backed resource (Useful Links unit)
 * — `file_type` stays NOT NULL at the DB level (no schema change needed for
 * that column), so a link resource gets this literal string instead of a
 * real MIME type. The trainee UI checks for this exact value to decide
 * "View/Open Link" vs "View/Download" (ResourcesPage.tsx).
 */
const LINK_FILE_TYPE = "LINK";

function toResponse(row: ResourceWithCategory): ResourceResponse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: { id: row.category.id, name: row.category.name },
    media_asset_id: row.mediaAssetId,
    external_url: row.externalUrl,
    file_type: row.fileType,
    uploaded_by: row.uploadedBy,
    status: row.status,
    is_downloadable: row.isDownloadable,
    departments: row.resourceDepartments.map((rd) => rd.department),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.resourceCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError({
      category_id: [`No resource category exists with id "${categoryId}".`],
    });
  }
}

/**
 * Validates a `media_asset_id` references a real, `resource-files`-bucket
 * asset, and returns its MIME type so callers can denormalize `file_type`
 * from it (§14.5: "denormalized from media_assets for fast filtering").
 * Deliberately does NOT check `uploaded_by` — unlike Queries'
 * `assertOwnAttachment` (a trainee's own private ticket attachment), a
 * resource file is shared admin-managed library content: any
 * `resource.manage` holder may attach any previously-uploaded
 * resource-files asset, not only the one they personally uploaded.
 */
async function assertResourceFileAsset(mediaAssetId: string): Promise<string> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media || media.bucket !== RESOURCE_FILES_BUCKET) {
    throw new ValidationError({
      media_asset_id: [`No resource file exists with id "${mediaAssetId}".`],
    });
  }
  return media.mimeType;
}

/**
 * POST /api/v1/admin/resources. `uploaded_by` always comes from the
 * authenticated request identity — never the request body (this project's
 * established anti-impersonation convention). `file_type` is always
 * server-derived — from the attached media asset's MIME type, or the fixed
 * `LINK_FILE_TYPE` sentinel for a URL-backed resource — never
 * client-supplied. `createResourceRequestSchema`'s own `.refine()` already
 * guarantees exactly one of `media_asset_id`/`external_url` reaches here
 * (Useful Links unit). Department targeting is NOT part of this call — a
 * fresh resource starts globally visible (empty `resource_departments`,
 * §14.5/§20's own "empty = global" rule) and is narrowed afterward via
 * `PUT /admin/resources/:id/departments`, mirroring how course-to-department
 * assignment is likewise not part of course create.
 */
export async function createResource(
  uploadedBy: string,
  input: CreateResourceRequest,
): Promise<ResourceResponse> {
  await assertCategoryExists(input.category_id);

  const isFileBacked = input.media_asset_id !== undefined;
  const fileType = isFileBacked
    ? await assertResourceFileAsset(input.media_asset_id!)
    : LINK_FILE_TYPE;

  const created = await prisma.resource.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      categoryId: input.category_id,
      mediaAssetId: isFileBacked ? input.media_asset_id! : null,
      externalUrl: isFileBacked ? null : (input.external_url ?? null),
      fileType,
      uploadedBy,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.is_downloadable !== undefined ? { isDownloadable: input.is_downloadable } : {}),
    },
    ...withCategory,
  });

  return toResponse(created);
}

/**
 * GET /api/v1/admin/resources — every resource regardless of status,
 * optionally filtered by status/category.
 */
export async function listAdminResources(
  query: ListAdminResourcesQuery,
): Promise<{ items: ResourceResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.category_id !== undefined ? { categoryId: query.category_id } : {}),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.resource.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withCategory,
    }),
    prisma.resource.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/admin/resources/:id. No 404-vs-403 existence-helper dance
 * needed here (unlike the trainee-facing detail endpoint): `resource.manage`
 * already means "sees all" per RLS, so a plain lookup returning nothing
 * means the id genuinely doesn't exist — the same reasoning
 * `getAdminQueryThreadOrThrow` documents for the analogous admin query path.
 */
export async function getAdminResource(id: string): Promise<ResourceResponse> {
  const row = await prisma.resource.findUnique({ where: { id }, ...withCategory });
  if (!row) {
    throw new NotFoundError(`No resource exists with id "${id}".`);
  }
  return toResponse(row);
}

/**
 * PATCH /api/v1/admin/resources/:id — partial update. Re-supplying
 * `media_asset_id` replaces the attached file (revalidated the same way as
 * creation) and recomputes `file_type` to match; re-supplying
 * `external_url` does the same for a URL-backed resource (`file_type`
 * becomes `LINK_FILE_TYPE`). `status` is this feature's publish/archive
 * ("delete") toggle.
 *
 * Useful Links unit: `updateResourceRequestSchema`'s own `.refine()` only
 * rejects a payload that sets BOTH fields to a real value in the same
 * request — it cannot see the existing row, so the full "exactly one, after
 * merge" invariant is re-validated here (same established pattern as
 * `updateAssessment`'s passing_marks<=total_marks re-check). Switching a
 * resource from file to link (or back) requires explicitly clearing the
 * other field in the same PATCH (e.g. `{ external_url: "...", media_asset_id:
 * null }`) — deliberately no implicit auto-clear, so a partial update can
 * never silently blank out the field the caller didn't mean to touch.
 */
export async function updateResource(
  id: string,
  input: UpdateResourceRequest,
): Promise<ResourceResponse> {
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No resource exists with id "${id}".`);
  }

  if (input.category_id !== undefined) {
    await assertCategoryExists(input.category_id);
  }

  const finalMediaAssetId =
    input.media_asset_id !== undefined ? input.media_asset_id : existing.mediaAssetId;
  const finalExternalUrl =
    input.external_url !== undefined ? input.external_url : existing.externalUrl;
  if ((finalMediaAssetId !== null) === (finalExternalUrl !== null)) {
    throw new ValidationError({
      media_asset_id: [
        "A resource must have exactly one of media_asset_id or external_url. To switch between a file and a link, explicitly clear the other field in the same request.",
      ],
    });
  }

  let fileType: string | undefined;
  if (input.media_asset_id !== undefined && input.media_asset_id !== null) {
    fileType = await assertResourceFileAsset(input.media_asset_id);
  } else if (input.external_url !== undefined && input.external_url !== null) {
    fileType = LINK_FILE_TYPE;
  }

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category_id !== undefined ? { categoryId: input.category_id } : {}),
      ...(input.media_asset_id !== undefined ? { mediaAssetId: input.media_asset_id } : {}),
      ...(input.external_url !== undefined ? { externalUrl: input.external_url } : {}),
      ...(fileType !== undefined ? { fileType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.is_downloadable !== undefined ? { isDownloadable: input.is_downloadable } : {}),
    },
    ...withCategory,
  });

  return toResponse(updated);
}
