import type { PolicyResponse, ListPoliciesQuery, PaginationMeta } from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Policy, PolicyVersion } from "../../generated/prisma/client.js";
import { effectivePolicyVisibilityFilter } from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

/**
 * Trainee-facing Policy & Procedures (SYSTEM_PLAN.md §14.8/§23/§26 `GET
 * /policies`, `GET /policies/:slug` — every authenticated user, the
 * ACTIVE version only, §23: "non-privileged users' list/detail endpoints
 * always filter is_active=true"). Deliberately a SEPARATE router/service
 * pair from admin-policies.routes.ts/admin-policies.service.ts (Admin
 * management, permission-gated), mirroring user-courses.routes.ts's
 * identical split from courses.routes.ts.
 *
 * Consistent granular access control unit (§7): department-based visibility
 * now exists for Policies (`policy_departments`, empty mapping = global —
 * same convention as resource_departments/announcement_departments), so a
 * policy that exists, has an active version, but is targeted at a
 * department this caller doesn't belong to is now a genuine per-caller
 * authorization boundary — a 403, not a 404-hide (§26/§31), mirroring
 * resources.service.ts/announcements.service.ts's identical 404-vs-403
 * distinction via `policy_exists_by_slug` (SECURITY DEFINER, boolean only).
 * A policy that genuinely has no active version yet remains the ordinary
 * 404 case (not a per-caller boundary — see `getPolicyDetail`).
 */

type PolicyVersionWithMime = PolicyVersion & { mediaAsset: { mimeType: string } | null };
type PolicyWithActiveVersion = Policy & { versions: PolicyVersionWithMime[] };

/**
 * Effective-date enforcement gap fix: a version counts as the trainee-
 * visible "active" one only when BOTH `is_active = true` AND
 * `effective_date <= asOf` — mirrors `training-hours.service.ts`'s own
 * `effectiveFrom: { lte: today }` convention for a `@db.Date` column
 * exactly (a plain `new Date()` compared with `lte`, no extra timezone
 * handling invented here). Without this, activating a version early (or
 * simply activating one whose `effective_date` is in the future) made it
 * immediately visible to trainees, ahead of its stated effective date.
 * `asOf` is threaded in per-call (rather than computed once as a module
 * constant) so each request evaluates against the moment it actually runs.
 */
function withActiveVersion(asOf: Date) {
  return {
    include: {
      versions: {
        where: { isActive: true, effectiveDate: { lte: asOf } },
        take: 1,
        // Download restriction unit: joins the attached document's MIME
        // type (a plain scalar select, not a second round trip — Prisma
        // batches this into the same query) so the trainee UI can pick the
        // correct in-app viewer instead of opening a signed URL directly.
        // Mirrors user-courses.service.ts's identical
        // `mediaAsset: { select: { mimeType: true } }` join.
        include: { mediaAsset: { select: { mimeType: true } } },
      },
    },
  } as const;
}

function toResponse(row: PolicyWithActiveVersion): PolicyResponse | null {
  const active = row.versions[0];
  if (!active) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    description: row.description,
    active_version: {
      id: active.id,
      version_label: active.versionLabel,
      media_asset_id: active.mediaAssetId,
      media_mime_type: active.mediaAsset?.mimeType ?? null,
      content: active.content,
      effective_date: active.effectiveDate.toISOString().slice(0, 10),
      updated_at: active.updatedAt.toISOString(),
    },
  };
}

/**
 * GET /api/v1/policies — only policies that currently have an active
 * version whose effective date has arrived (§14.8/§23: "Trainer API must
 * return only the latest active version of available policies" — a policy
 * with none is not yet "available"; a version active-but-not-yet-effective
 * isn't "available" either — see `withActiveVersion`'s own doc comment) AND
 * are department-visible to this caller (§7, `effectivePolicyVisibilityFilter`
 * — the exact predicate `canViewPolicy()` is composed from, same "no N+1
 * authorization" bulk-WHERE-clause shape as listResources/listAnnouncements).
 * Filters server-side, never a client-side hide of a broader fetched set.
 */
export async function listPolicies(
  userId: string,
  query: ListPoliciesQuery,
): Promise<{ items: PolicyResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const asOf = new Date();
  const where = {
    versions: { some: { isActive: true, effectiveDate: { lte: asOf } } },
    ...effectivePolicyVisibilityFilter(userId),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.policy.findMany({
      where,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withActiveVersion(asOf),
    }),
    prisma.policy.count({ where }),
  ]);

  // toResponse can only return null if a row's active version somehow
  // disappeared between the `where` count and this map (a concurrent
  // deactivation) — filtered out defensively rather than crashing the list.
  return {
    items: rows.map(toResponse).filter((item): item is PolicyResponse => item !== null),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/policies/:slug — the policy plus its active version's full
 * content/media reference. 404 both when the slug doesn't exist at all and
 * when the policy exists but has no active version yet (not a per-caller
 * authorization boundary — see this file's own header comment). A policy
 * that DOES have an active version but is targeted at a department this
 * caller doesn't belong to is a 403, not a 404-hide — `policy_exists_by_slug`
 * (SECURITY DEFINER, boolean only) restores that distinction the same way
 * `resource_exists`/`announcement_exists` do for their own features.
 */
export async function getPolicyDetail(userId: string, slug: string): Promise<PolicyResponse> {
  const row = await prisma.policy.findUnique({
    where: { slug },
    ...withActiveVersion(new Date()),
  });
  if (!row) {
    const [existsRow] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.policy_exists_by_slug(${slug}) AS exists`;
    if (!existsRow?.exists) {
      throw new NotFoundError(`No policy exists with slug "${slug}".`);
    }
    throw new ForbiddenError();
  }
  const response = toResponse(row);
  if (!response) {
    throw new NotFoundError(`No policy exists with slug "${slug}".`);
  }

  const visible = await prisma.policy.findFirst({
    where: { id: row.id, ...effectivePolicyVisibilityFilter(userId) },
    select: { id: true },
  });
  if (!visible) {
    throw new ForbiddenError();
  }

  return response;
}
