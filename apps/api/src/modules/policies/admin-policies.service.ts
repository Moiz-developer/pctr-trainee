import type {
  AdminPolicyResponse,
  AdminPolicyDetail,
  PolicyVersionResponse,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  CreatePolicyVersionRequest,
  UpdatePolicyVersionRequest,
  ListAdminPoliciesQuery,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import { Prisma, type Policy, type PolicyVersion } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { POLICY_DOCUMENTS_BUCKET } from "../media/media.constants.js";

/**
 * Admin Policy & Procedures management (SYSTEM_PLAN.md §14.8/§23/§26,
 * Phase 5.2). Two deliberately separate permissions gate this feature:
 * `policy.manage` (create/update policies and versions, upload/replace
 * documents — see admin-policies.routes.ts) and the pre-existing
 * `policy.version.activate` (activation only, `activatePolicyVersion`
 * below). No separate architecture: reuses the exact `media_assets`/
 * signed-URL flow already built for course-media/query-attachments/
 * resource-files (see media.service.ts's purpose-aware upload/confirm).
 */

type PolicyVersionWithMime = PolicyVersion & { mediaAsset: { mimeType: string } | null };
type PolicyWithVersions = Policy & { versions: PolicyVersionWithMime[] };

// Download restriction unit (media_mime_type on activePolicyVersionSchema):
// joins the attached document's MIME type alongside each version — a plain
// scalar select, not a second round trip — so the admin-facing
// `active_version.media_mime_type` (now required by the shared schema,
// mirroring policies.service.ts's trainee-facing `withActiveVersion`) is
// always populated from the real, current media_assets row, never
// hardcoded or omitted.
const withVersionMedia = {
  include: { mediaAsset: { select: { mimeType: true } } },
} as const;

function toVersionResponse(version: PolicyVersion): PolicyVersionResponse {
  return {
    id: version.id,
    policy_id: version.policyId,
    version_label: version.versionLabel,
    media_asset_id: version.mediaAssetId,
    content: version.content,
    effective_date: version.effectiveDate.toISOString().slice(0, 10),
    is_active: version.isActive,
    is_archived: version.isArchived,
    uploaded_by: version.uploadedBy,
    created_at: version.createdAt.toISOString(),
    updated_at: version.updatedAt.toISOString(),
  };
}

function toAdminResponse(row: PolicyWithVersions): AdminPolicyResponse {
  const active = row.versions.find((v) => v.isActive) ?? null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    description: row.description,
    active_version: active
      ? {
          id: active.id,
          version_label: active.versionLabel,
          media_asset_id: active.mediaAssetId,
          media_mime_type: active.mediaAsset?.mimeType ?? null,
          content: active.content,
          effective_date: active.effectiveDate.toISOString().slice(0, 10),
          updated_at: active.updatedAt.toISOString(),
        }
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function assertNoSlugConflict(slug: string, excludeId?: string): Promise<void> {
  const existing = await prisma.policy.findUnique({ where: { slug } });
  if (existing && existing.id !== excludeId) {
    throw new ConflictError(`slug "${slug}" is already in use.`);
  }
}

/**
 * Validates a `media_asset_id` references a real, `policy-documents`-bucket
 * asset. Deliberately does NOT check `uploaded_by` — like Resources'
 * `assertResourceFileAsset`, a policy document is shared admin-managed
 * content: any `policy.manage` holder may attach any previously-uploaded
 * policy-documents asset, not only the one they personally uploaded.
 */
async function assertPolicyDocumentAsset(mediaAssetId: string): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media || media.bucket !== POLICY_DOCUMENTS_BUCKET) {
    throw new ValidationError({
      media_asset_id: [`No policy document exists with id "${mediaAssetId}".`],
    });
  }
}

/** POST /api/v1/admin/policies (permission `policy.manage`). */
export async function createPolicy(input: CreatePolicyRequest): Promise<AdminPolicyResponse> {
  await assertNoSlugConflict(input.slug);

  try {
    const created = await prisma.policy.create({
      data: {
        title: input.title,
        slug: input.slug,
        category: input.category ?? null,
        description: input.description ?? null,
      },
      include: { versions: withVersionMedia },
    });
    return toAdminResponse(created);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A policy with the given slug already exists.");
    }
    throw dbError;
  }
}

/** GET /api/v1/admin/policies — every policy, regardless of whether it has an active version. */
export async function listAdminPolicies(
  query: ListAdminPoliciesQuery,
): Promise<{ items: AdminPolicyResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const [rows, totalItems] = await Promise.all([
    prisma.policy.findMany({
      orderBy: [{ title: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { versions: withVersionMedia },
    }),
    prisma.policy.count(),
  ]);

  return {
    items: rows.map(toAdminResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/admin/policies/:id — the policy plus EVERY version (active,
 * archived, draft), oldest first (§23: "admins can browse full history
 * including archived versions for audit purposes").
 */
export async function getAdminPolicy(id: string): Promise<AdminPolicyDetail> {
  const row = await prisma.policy.findUnique({
    where: { id },
    include: {
      versions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], ...withVersionMedia },
    },
  });
  if (!row) {
    throw new NotFoundError(`No policy exists with id "${id}".`);
  }
  return { ...toAdminResponse(row), versions: row.versions.map(toVersionResponse) };
}

/** PATCH /api/v1/admin/policies/:id — the policy's own metadata (not its versions). */
export async function updatePolicy(
  id: string,
  input: UpdatePolicyRequest,
): Promise<AdminPolicyResponse> {
  const existing = await prisma.policy.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`No policy exists with id "${id}".`);
  }
  if (input.slug !== undefined) {
    await assertNoSlugConflict(input.slug, id);
  }

  try {
    const updated = await prisma.policy.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: { versions: withVersionMedia },
    });
    return toAdminResponse(updated);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError("A policy with the given slug already exists.");
    }
    throw dbError;
  }
}

async function assertPolicyExists(policyId: string): Promise<void> {
  const policy = await prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } });
  if (!policy) {
    throw new NotFoundError(`No policy exists with id "${policyId}".`);
  }
}

/**
 * POST /api/v1/admin/policies/:policyId/versions (permission
 * `policy.manage`). Never starts active (the DB default, and never set
 * here) — activation is always the separate `activatePolicyVersion` call.
 * `uploaded_by` always comes from the authenticated request identity, never
 * the request body.
 */
export async function createPolicyVersion(
  uploadedBy: string,
  policyId: string,
  input: CreatePolicyVersionRequest,
): Promise<PolicyVersionResponse> {
  await assertPolicyExists(policyId);
  if (input.media_asset_id) {
    await assertPolicyDocumentAsset(input.media_asset_id);
  }

  try {
    const created = await prisma.policyVersion.create({
      data: {
        policyId,
        versionLabel: input.version_label,
        mediaAssetId: input.media_asset_id ?? null,
        content: input.content ?? null,
        effectiveDate: new Date(input.effective_date),
        uploadedBy,
      },
    });
    return toVersionResponse(created);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError(
        `Version "${input.version_label}" already exists for this policy.`,
      );
    }
    throw dbError;
  }
}

/**
 * PATCH /api/v1/admin/policies/:policyId/versions/:versionId — partial
 * update, including "upload/replace documents" (re-supplying
 * `media_asset_id`). Never accepts `is_active`/`is_archived` — see
 * packages/shared/src/api/policies.ts's own doc comment for why.
 */
export async function updatePolicyVersion(
  policyId: string,
  versionId: string,
  input: UpdatePolicyVersionRequest,
): Promise<PolicyVersionResponse> {
  const existing = await prisma.policyVersion.findUnique({ where: { id: versionId } });
  if (!existing || existing.policyId !== policyId) {
    throw new NotFoundError(`No version exists with id "${versionId}" for this policy.`);
  }
  if (input.media_asset_id !== undefined) {
    await assertPolicyDocumentAsset(input.media_asset_id);
  }

  try {
    const updated = await prisma.policyVersion.update({
      where: { id: versionId },
      data: {
        ...(input.version_label !== undefined ? { versionLabel: input.version_label } : {}),
        ...(input.effective_date !== undefined
          ? { effectiveDate: new Date(input.effective_date) }
          : {}),
        ...(input.media_asset_id !== undefined ? { mediaAssetId: input.media_asset_id } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
      },
    });
    return toVersionResponse(updated);
  } catch (dbError) {
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === "P2002") {
      throw new ConflictError(
        `Version "${input.version_label}" already exists for this policy.`,
      );
    }
    throw dbError;
  }
}

/**
 * POST /api/v1/admin/policies/:policyId/versions/:versionId/activate
 * (permission `policy.version.activate` — the one permission SYSTEM_PLAN.md
 * already names for this exact action, §5). Transactional two-step
 * supersede, exactly as §14.8 specifies: the previous active version (if
 * any, and if different from the target) is set `is_active=false,
 * is_archived=true`; the target is set `is_active=true, is_archived=false`
 * (covers re-activating a previously superseded version — full history is
 * retained, never deleted, §23). Both writes share one transaction, so a
 * concurrent read can never observe zero or two active versions for this
 * policy — backstopped at the database level by
 * `policy_versions_one_active_per_policy` (the partial unique index), which
 * would reject this transaction outright if that ever somehow became
 * false.
 */
export async function activatePolicyVersion(
  policyId: string,
  versionId: string,
): Promise<AdminPolicyDetail> {
  const target = await prisma.policyVersion.findUnique({ where: { id: versionId } });
  if (!target || target.policyId !== policyId) {
    throw new NotFoundError(`No version exists with id "${versionId}" for this policy.`);
  }

  const currentActive = await prisma.policyVersion.findFirst({
    where: { policyId, isActive: true, id: { not: versionId } },
  });

  await prisma.$transaction([
    ...(currentActive
      ? [
          prisma.policyVersion.update({
            where: { id: currentActive.id },
            data: { isActive: false, isArchived: true },
          }),
        ]
      : []),
    prisma.policyVersion.update({
      where: { id: versionId },
      data: { isActive: true, isArchived: false },
    }),
  ]);

  return getAdminPolicy(policyId);
}

/**
 * POST /api/v1/admin/policies/:policyId/versions/:versionId/archive
 * (permission `policy.version.activate` — the same permission that gates
 * `activatePolicyVersion` above, since archiving is that same action's
 * direct inverse: a version/policy-manage-adjacent state transition, not a
 * content edit). Standalone archive gap fix: previously `isArchived` was
 * only ever set as an automatic side effect of activating a REPLACEMENT
 * version (inside `activatePolicyVersion`) — there was no way to archive a
 * version (typically the currently active one, to pull a policy from
 * trainee visibility) without simultaneously activating a different one.
 * This action sets exactly `isActive=false, isArchived=true` on the target
 * version alone; it never touches any other version, and never activates
 * anything — deliberately not folded into `activatePolicyVersion`, whose
 * own two-step supersede behavior stays completely unchanged.
 */
export async function archivePolicyVersion(
  policyId: string,
  versionId: string,
): Promise<AdminPolicyDetail> {
  const target = await prisma.policyVersion.findUnique({ where: { id: versionId } });
  if (!target || target.policyId !== policyId) {
    throw new NotFoundError(`No version exists with id "${versionId}" for this policy.`);
  }

  await prisma.policyVersion.update({
    where: { id: versionId },
    data: { isActive: false, isArchived: true },
  });

  return getAdminPolicy(policyId);
}
