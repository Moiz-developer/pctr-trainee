import type {
  ResourceResponse,
  ListResourcesQuery,
  ResourceCategoryResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma } from "../../lib/prisma.js";
import type { Resource } from "../../generated/prisma/client.js";
import { effectiveResourceVisibilityFilter } from "../authorization/access.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

/**
 * Trainee-facing Resource Library (SYSTEM_PLAN.md §14.5/§20/§26 `GET
 * /resources`, "self" — every authenticated user, PUBLISHED +
 * department-visible only). Deliberately a SEPARATE router/service pair
 * from admin-resources.routes.ts/admin-resources.service.ts (Admin
 * management, permission-gated `resource.manage`) so Admin and User
 * authorization semantics can never be accidentally mixed — mirrors
 * user-courses.routes.ts's identical split from courses.routes.ts.
 */

type ResourceWithCategory = Resource & {
  category: { id: string; name: string };
  resourceDepartments: { department: { id: string; name: string } }[];
};

const withCategory = {
  include: {
    category: { select: { id: true, name: true } },
    // Department visibility in the Trainer Portal UI unit: a plain scalar
    // join (Prisma batches it into the same query, no extra round trip) —
    // read-only display of the same `resource_departments` data
    // `effectiveResourceVisibilityFilter` (above) already treats as
    // authoritative for access control. Mirrors admin-resources.service.ts's
    // identical addition, since `ResourceResponse` is shared by both.
    resourceDepartments: { select: { department: { select: { id: true, name: true } } } },
  },
} as const;

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

/**
 * GET /api/v1/resources (SYSTEM_PLAN.md §26): only `PUBLISHED` resources
 * the caller can see (§14.5/§20's department-visibility rule — empty
 * `resource_departments` = global). Uses `effectiveResourceVisibilityFilter`
 * — the exact predicate `canViewResource()` is composed from — as a single
 * bulk WHERE clause, the same "no N+1 authorization" shape as
 * `listUserCourses`. `category_id`, when supplied, is a plain server-side
 * WHERE filter, never a client-side list-then-hide (never trust frontend
 * filtering for authorization) — combined with the visibility filter, not
 * a substitute for it.
 */
export async function listResources(
  userId: string,
  query: ListResourcesQuery,
): Promise<{ items: ResourceResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    status: "PUBLISHED" as const,
    ...(query.category_id !== undefined ? { categoryId: query.category_id } : {}),
    ...effectiveResourceVisibilityFilter(userId),
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
 * GET /api/v1/resources/:id (SYSTEM_PLAN.md §26/§31: "403 if not
 * authorized, not a 404-hide"). A genuinely nonexistent id, or a real
 * ARCHIVED/department-hidden one, are distinguished the same way
 * `getUserCourseDetail` distinguishes them — `resource_exists` (SECURITY
 * DEFINER, boolean only) restores the 404-vs-403 split RLS's own row-hiding
 * would otherwise collapse.
 */
export async function getResourceDetail(userId: string, resourceId: string): Promise<ResourceResponse> {
  const row = await prisma.resource.findUnique({ where: { id: resourceId }, ...withCategory });
  if (!row) {
    const [existsRow] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.resource_exists(${resourceId}::uuid) AS exists`;
    if (!existsRow?.exists) {
      throw new NotFoundError(`No resource exists with id "${resourceId}".`);
    }
    throw new ForbiddenError();
  }
  if (row.status !== "PUBLISHED") {
    throw new ForbiddenError();
  }

  const visible = await prisma.resource.findFirst({
    where: { id: resourceId, ...effectiveResourceVisibilityFilter(userId) },
    select: { id: true },
  });
  if (!visible) {
    throw new ForbiddenError();
  }

  return toResponse(row);
}

/**
 * GET /api/v1/resources/categories — active categories, for the trainee
 * filter dropdown. Deliberately NOT scoped to "categories with at least one
 * currently-visible resource": `resource_categories` is a plain lookup
 * table (mirrors `course_categories`, readable by any authenticated user at
 * the RLS layer — see the migration's own comment), and selecting a
 * category with zero currently-visible resources just yields an empty list,
 * not a security concern — simpler than re-deriving a visibility-aware
 * distinct-values query for a filter dropdown.
 *
 * Department -> Category -> Training Content hierarchy unit: also filtered
 * to categories that are either global (`department_id IS NULL`) or belong
 * to one of the caller's own departments — `department: { userDepartments:
 * { some: { userId } } }` is the exact same relational-join shape
 * `effectiveResourceVisibilityFilter` itself already uses one level up (for
 * resources, not their categories); this is a presentation-relevance filter
 * (an admin still sees every category, department-scoped or not, via
 * `GET /admin/resource-categories`), not a new access-control boundary —
 * category rows are never sensitive.
 */
export async function listVisibleResourceCategories(userId: string): Promise<ResourceCategoryResponse[]> {
  const rows = await prisma.resourceCategory.findMany({
    where: {
      isActive: true,
      OR: [{ departmentId: null }, { department: { userDepartments: { some: { userId } } } }],
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    is_active: row.isActive,
    department_id: row.departmentId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }));
}
