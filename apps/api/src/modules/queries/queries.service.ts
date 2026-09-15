import type {
  CreateQueryRequest,
  CreateQueryMessageRequest,
  ListQueriesQuery,
  QueryResponse,
  QueryDetail,
  QueryMessageResponse,
  QueryCategoryResponse,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma, LONG_TRANSACTION_OPTIONS } from "../../lib/prisma.js";
import type { Query } from "../../generated/prisma/client.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { QUERY_ATTACHMENTS_BUCKET } from "../media/media.constants.js";

type QueryWithCourse = Query & {
  course: { title: string } | null;
  categoryRecord: { name: string } | null;
  messages: { attachments: unknown[] }[];
};

const withCourse = {
  include: {
    course: { select: { title: true } },
    // Query Category dropdown unit — denormalized name join, the exact same
    // convenience-join shape `course` above already establishes.
    categoryRecord: { select: { name: true } },
    // Only ever used to derive `has_attachment` below — never returned
    // as-is; a query created via this unit has at most one message (its
    // own opening one, created only when an attachment is supplied).
    messages: { select: { attachments: { select: { mediaAssetId: true } } } },
  },
} as const;

function toResponse(row: QueryWithCourse): QueryResponse {
  return {
    id: row.id,
    user_id: row.userId,
    subject: row.subject,
    category: row.category,
    category_id: row.categoryId,
    category_name: row.categoryRecord?.name ?? null,
    description: row.description,
    course_id: row.courseId,
    course_title: row.course?.title ?? null,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assignedTo,
    has_attachment: row.messages.some((message) => message.attachments.length > 0),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * POST /api/v1/queries (SYSTEM_PLAN.md §14.7/§22/§26 "self"). `user_id`
 * always comes from the authenticated request identity — the route param —
 * never the request body, the actual anti-impersonation mechanism (matches
 * `updateLessonProgress`'s/`createTrainingHourRequirement`'s pattern).
 * `status` is never accepted here — every new ticket starts `OPEN` (the DB
 * default); admin-side status transitions are a later unit.
 *
 * Phase 6.2 — optional attachment: `media_asset_id` must reference a
 * `query-attachments`-bucket asset this same caller uploaded (never
 * someone else's file, and never a `course-media` asset — both checked
 * server-side, not merely assumed from the client's declared purpose).
 * Per §14.7's schema an attachment hangs off a `query_messages` row, not
 * the `queries` row directly, so this creates the ticket's own opening
 * message (sender = the caller, text = the ticket description) to carry
 * it — one transaction, so the query never ends up attachment-less due to
 * a partial failure.
 *
 * Query Category dropdown unit: `category_id`, if supplied, must reference
 * an existing `query_categories` row (existence-only check, same shape as
 * the `course_id` check above — not gated on `is_active`, mirroring
 * admin-resources.service.ts's `assertCategoryExists`). `category` (legacy
 * free text) is still accepted and stored as-is for backward compatibility
 * with any other caller, but the trainee create form no longer sends it.
 */
export async function createQuery(
  userId: string,
  input: CreateQueryRequest,
): Promise<QueryResponse> {
  if (input.course_id) {
    const course = await prisma.course.findUnique({ where: { id: input.course_id } });
    if (!course) {
      throw new ValidationError({ course_id: [`No course exists with id "${input.course_id}".`] });
    }
  }

  if (input.category_id) {
    const category = await prisma.queryCategory.findUnique({ where: { id: input.category_id } });
    if (!category) {
      throw new ValidationError({
        category_id: [`No query category exists with id "${input.category_id}".`],
      });
    }
  }

  if (input.media_asset_id) {
    await assertOwnAttachment(userId, input.media_asset_id);
  }

  const row = await prisma.$transaction(async (tx) => {
    const query = await tx.query.create({
      data: {
        userId,
        subject: input.subject,
        category: input.category ?? null,
        categoryId: input.category_id ?? null,
        description: input.description,
        courseId: input.course_id ?? null,
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      },
    });

    if (input.media_asset_id) {
      await tx.queryMessage.create({
        data: {
          queryId: query.id,
          senderId: userId,
          message: input.description,
          attachments: {
            create: { mediaAssetId: input.media_asset_id },
          },
        },
      });
    }

    return tx.query.findUniqueOrThrow({ where: { id: query.id }, ...withCourse });
  }, LONG_TRANSACTION_OPTIONS);

  return toResponse(row);
}

/**
 * GET /api/v1/queries — the caller's own tickets only (§22: "A user can
 * only ever see/query queries where user_id = self"). Ownership is enforced
 * here via the WHERE clause using the authenticated identity, not a
 * client-suppliable filter — mirrored by this same table's self-only RLS
 * `queries_select` policy (defense-in-depth, not the primary gate).
 */
export async function listUserQueries(
  userId: string,
  query: ListQueriesQuery,
): Promise<{ items: QueryResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = { userId };

  const [rows, totalItems] = await Promise.all([
    prisma.query.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withCourse,
    }),
    prisma.query.count({ where }),
  ]);

  return {
    items: rows.map(toResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

// Full detail include: the query's own course join (for toResponse's shared
// fields) plus its complete conversation thread, oldest first, each
// message's sender name and any attached file's viewable metadata (never
// the raw storage path/bucket — a viewer resolves those via the existing
// GET /media/:id/access-url flow, same as every other media reference in
// this codebase).
const withThread = {
  include: {
    course: { select: { title: true } },
    categoryRecord: { select: { name: true } },
    messages: {
      orderBy: { createdAt: "asc" as const },
      include: {
        sender: { select: { fullName: true } },
        attachments: {
          include: { mediaAsset: { select: { originalFilename: true, mimeType: true } } },
        },
      },
    },
  },
} as const;

type QueryWithThread = Query & {
  course: { title: string } | null;
  categoryRecord: { name: string } | null;
  messages: Array<{
    id: string;
    senderId: string | null;
    sender: { fullName: string } | null;
    message: string;
    createdAt: Date;
    attachments: Array<{
      mediaAssetId: string;
      mediaAsset: { originalFilename: string; mimeType: string };
    }>;
  }>;
};

export function toMessageResponse(
  message: QueryWithThread["messages"][number],
): QueryMessageResponse {
  return {
    id: message.id,
    sender_id: message.senderId,
    sender_name: message.sender?.fullName ?? null,
    message: message.message,
    created_at: message.createdAt.toISOString(),
    attachments: message.attachments.map((attachment) => ({
      id: attachment.mediaAssetId,
      original_filename: attachment.mediaAsset.originalFilename,
      mime_type: attachment.mediaAsset.mimeType,
    })),
  };
}

function toDetailResponse(row: QueryWithThread): QueryDetail {
  return {
    id: row.id,
    user_id: row.userId,
    subject: row.subject,
    category: row.category,
    category_id: row.categoryId,
    category_name: row.categoryRecord?.name ?? null,
    description: row.description,
    course_id: row.courseId,
    course_title: row.course?.title ?? null,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assignedTo,
    has_attachment: row.messages.some((message) => message.attachments.length > 0),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    messages: row.messages.map(toMessageResponse),
  };
}

/**
 * Loads a query's full thread and verifies ownership, mirroring
 * progress.service.ts's loadAuthorizedLesson / media.service.ts's
 * getMediaAccessUrl exactly: a genuinely nonexistent id is 404; a real id
 * belonging to someone else is 403 (§26/§31), not a 404-hide. Under RLS's
 * self-only `queries_select` policy a plain lookup for another user's query
 * already returns nothing — `query_exists` (SECURITY DEFINER, boolean only)
 * restores the 404-vs-403 distinction that collapses under RLS otherwise.
 * The explicit `row.userId !== userId` check below is defense-in-depth for
 * the same reason `course.status !== "PUBLISHED"` is still checked in
 * user-courses.service.ts even though RLS also enforces it — this route is
 * self-only regardless of what a future admin permission might one day let
 * RLS itself admit.
 */
async function getOwnedQueryThread(userId: string, queryId: string): Promise<QueryWithThread> {
  const row = await prisma.query.findUnique({ where: { id: queryId }, ...withThread });
  if (!row) {
    const [existsRow] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT public.query_exists(${queryId}::uuid) AS exists`;
    if (!existsRow?.exists) {
      throw new NotFoundError(`No query exists with id "${queryId}".`);
    }
    throw new ForbiddenError();
  }
  if (row.userId !== userId) {
    throw new ForbiddenError();
  }
  return row;
}

/**
 * Shared attachment-ownership check (Phase 6.2/6.4/6.7): a `media_asset_id`
 * must be this caller's own `query-attachments`-bucket upload, never
 * anyone else's file or a `course-media` asset — true for a trainee
 * creating/replying to their own ticket AND for an admin replying to any
 * ticket (Phase 6.7), since both upload their OWN reply attachment through
 * the same generic media flow. Exported for reuse by
 * admin-queries.service.ts's createAdminQueryMessage.
 */
export async function assertOwnAttachment(userId: string, mediaAssetId: string): Promise<void> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!media || media.bucket !== QUERY_ATTACHMENTS_BUCKET || media.uploadedBy !== userId) {
    throw new ValidationError({
      media_asset_id: [`No attachment exists with id "${mediaAssetId}".`],
    });
  }
}

/**
 * GET /api/v1/queries/:id (Phase 6.4 — SYSTEM_PLAN.md §14.7/§22/§26): the
 * full ticket plus its conversation thread — the trainer's own original
 * query (top-level fields) and every message in it so far, including any
 * Admin/Support responses (any message on a query this caller owns is
 * visible to them, regardless of who sent it — the same self-only-by-query-
 * ownership rule `query_messages_select`'s RLS policy already encodes).
 */
export async function getQueryDetail(userId: string, queryId: string): Promise<QueryDetail> {
  const row = await getOwnedQueryThread(userId, queryId);
  return toDetailResponse(row);
}

/**
 * POST /api/v1/queries/:id/messages (Phase 6.4): a follow-up message from
 * the ticket owner. `sender_id` always comes from the authenticated
 * identity — never the request body (same anti-impersonation convention as
 * `createQuery`). Reuses the exact same optional-attachment shape as ticket
 * creation (Phase 6.2) — no separate upload/attach mechanism invented.
 */
export async function createQueryMessage(
  userId: string,
  queryId: string,
  input: CreateQueryMessageRequest,
): Promise<QueryMessageResponse> {
  await getOwnedQueryThread(userId, queryId);

  if (input.media_asset_id) {
    await assertOwnAttachment(userId, input.media_asset_id);
  }

  const created = await prisma.queryMessage.create({
    data: {
      queryId,
      senderId: userId,
      message: input.message,
      ...(input.media_asset_id
        ? { attachments: { create: { mediaAssetId: input.media_asset_id } } }
        : {}),
    },
    include: {
      sender: { select: { fullName: true } },
      attachments: {
        include: { mediaAsset: { select: { originalFilename: true, mimeType: true } } },
      },
    },
  });

  return toMessageResponse(created);
}

/**
 * GET /api/v1/queries/categories (Query Category dropdown unit) — active
 * categories only, for the trainee create-form dropdown. Auth-only (no
 * `query.manage` gate): mirrors `listVisibleResourceCategories`
 * (resources.service.ts) exactly — any authenticated trainee needs to read
 * this to create a ticket, same as `resource_categories`/`course_categories`
 * being universally readable at the RLS layer.
 *
 * Department -> Category -> Training Content hierarchy unit: also filtered
 * to categories that are either global (`department_id IS NULL`) or belong
 * to one of the caller's own departments — same relational-join shape
 * `listVisibleResourceCategories` uses; a presentation-relevance filter,
 * not a new access-control boundary (an admin still sees every category,
 * department-scoped or not, via `GET /admin/query-categories`).
 */
export async function listVisibleQueryCategories(userId: string): Promise<QueryCategoryResponse[]> {
  const rows = await prisma.queryCategory.findMany({
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
