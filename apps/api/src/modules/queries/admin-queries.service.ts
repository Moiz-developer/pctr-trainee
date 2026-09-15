import type {
  AdminQueryResponse,
  AdminQueryDetail,
  CreateQueryMessageRequest,
  ListAdminQueriesQuery,
  QueryManager,
  QueryMessageResponse,
  UpdateAdminQueryRequest,
  PaginationMeta,
} from "@internal-training/shared";
import { prisma, LONG_TRANSACTION_OPTIONS } from "../../lib/prisma.js";
import type { Query } from "../../generated/prisma/client.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordAuditLog } from "../../lib/audit.js";
import { assertOwnAttachment, toMessageResponse } from "./queries.service.js";

type AdminQueryRow = Query & {
  user: { fullName: string };
  course: { title: string } | null;
  categoryRecord: { name: string } | null;
  messages: { attachments: unknown[] }[];
};

const withAdminJoins = {
  include: {
    user: { select: { fullName: true } },
    course: { select: { title: true } },
    // Query Category dropdown unit — same denormalized-name-join shape as
    // `course` above; mirrors queries.service.ts's own `withCourse`.
    categoryRecord: { select: { name: true } },
    // Only ever used to derive `has_attachment` below — never returned
    // as-is, mirroring queries.service.ts's own `withCourse` shape.
    messages: { select: { attachments: { select: { mediaAssetId: true } } } },
  },
} as const;

function toAdminResponse(row: AdminQueryRow): AdminQueryResponse {
  return {
    id: row.id,
    user_id: row.userId,
    user_full_name: row.user.fullName,
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
 * GET /api/v1/admin/queries (SYSTEM_PLAN.md §14.7/§22/§26, permission
 * `query.manage` — the one permission code the plan itself names for query
 * oversight: "support-permission holders ... see all"). Every ticket, not
 * self-scoped — the read-only admin queue. `status`/`priority`/`category`
 * filters are applied server-side via the WHERE clause, never trusted from
 * anywhere else; matches the same "server-derives-the-authorized/filtered-
 * set" convention as every other admin list endpoint in this codebase.
 */
export async function listAdminQueries(
  query: ListAdminQueriesQuery,
): Promise<{ items: AdminQueryResponse[]; meta: PaginationMeta }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const where = {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.priority !== undefined ? { priority: query.priority } : {}),
    ...(query.category !== undefined ? { category: query.category } : {}),
  };

  const [rows, totalItems] = await Promise.all([
    prisma.query.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      ...withAdminJoins,
    }),
    prisma.query.count({ where }),
  ]);

  return {
    items: rows.map(toAdminResponse),
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
  };
}

/**
 * GET /api/v1/admin/queries/categories (permission `query.manage`) — the
 * distinct, non-null `category` values currently in use across all
 * tickets, so the admin filter can offer a dropdown of real values instead
 * of requiring an exact string typed from memory. §14.7 defines no
 * dedicated categories lookup table for queries (unlike
 * course_categories/resource_categories) — category is free text a
 * trainee typed at ticket creation, so this is derived, not a managed list.
 */
export async function listQueryCategories(): Promise<string[]> {
  const rows = await prisma.query.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.flatMap((row) => (row.category !== null ? [row.category] : []));
}

// Full detail include for the admin view: the same course/user joins as
// the list, plus the complete conversation thread — structurally identical
// to queries.service.ts's own `withThread` message shape (id, senderId,
// sender.fullName, message, createdAt, attachments+mediaAsset) so
// `toMessageResponse` (imported from there) can be reused as-is here,
// rather than duplicating that mapping.
const withAdminThread = {
  include: {
    user: { select: { fullName: true } },
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

type AdminQueryWithThread = Query & {
  user: { fullName: string };
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

function toAdminDetailResponse(row: AdminQueryWithThread): AdminQueryDetail {
  return {
    ...toAdminResponse(row),
    messages: row.messages.map(toMessageResponse),
  };
}

/**
 * Loads a query's full thread for admin management. Unlike
 * queries.service.ts's `getOwnedQueryThread`, there is no ownership check
 * here — `query.manage` (enforced at the route) already means "sees all"
 * per §22, and RLS's own `queries_select` policy grants the same full
 * visibility, so a plain lookup returning nothing means the id genuinely
 * doesn't exist (no 403-vs-404 existence-helper dance needed, unlike the
 * self-only trainee endpoint, which has to distinguish "hidden by RLS"
 * from "truly absent").
 */
async function getAdminQueryThreadOrThrow(queryId: string): Promise<AdminQueryWithThread> {
  const row = await prisma.query.findUnique({ where: { id: queryId }, ...withAdminThread });
  if (!row) {
    throw new NotFoundError(`No query exists with id "${queryId}".`);
  }
  return row;
}

/**
 * GET /api/v1/admin/queries/:id (Phase 6.7, permission `query.manage`):
 * the full ticket plus its conversation thread — same shape as the
 * trainer's own `GET /queries/:id`, plus `user_full_name` so the admin
 * knows whose ticket it is. No separate support architecture: identical
 * `queries`/`query_messages`/`query_attachments` tables, just without the
 * self-only restriction.
 */
export async function getAdminQueryDetail(queryId: string): Promise<AdminQueryDetail> {
  const row = await getAdminQueryThreadOrThrow(queryId);
  return toAdminDetailResponse(row);
}

/**
 * POST /api/v1/admin/queries/:id/messages (Phase 6.7): an admin/support
 * reply. `sender_id` is always the authenticated admin's own id — never
 * client-supplied — so the trainer sees who responded. Reuses the exact
 * same optional-attachment shape and ownership validation as every other
 * message-posting path (Phase 6.2/6.4) via the shared `assertOwnAttachment`.
 *
 * Phase 6.9: a support response is a privileged action (§32's own audit
 * list: "query status changed" and admin actions generally) — logged as
 * `query.response.created` in the same transaction as the message write,
 * so the log can never exist without the action it describes (or vice
 * versa). Only the message id + whether it carried an attachment is
 * recorded, not the message body itself — the full text already lives in
 * `query_messages`, and §32 asks for "non-sensitive before/after fields,"
 * not a duplicate copy of user-authored content.
 */
export async function createAdminQueryMessage(
  adminId: string,
  queryId: string,
  input: CreateQueryMessageRequest,
  ipAddress: string | null = null,
): Promise<QueryMessageResponse> {
  await getAdminQueryThreadOrThrow(queryId);

  if (input.media_asset_id) {
    await assertOwnAttachment(adminId, input.media_asset_id);
  }

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.queryMessage.create({
      data: {
        queryId,
        senderId: adminId,
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

    await recordAuditLog(
      {
        actorId: adminId,
        action: "query.response.created",
        entityType: "query",
        entityId: queryId,
        metadata: { message_id: message.id, has_attachment: Boolean(input.media_asset_id) },
        ipAddress,
      },
      tx,
    );

    return message;
  }, LONG_TRANSACTION_OPTIONS);

  return toMessageResponse(created);
}

/**
 * PATCH /api/v1/admin/queries/:id (Phase 6.7): change `status` and/or
 * (re)assign the ticket. `assigned_to`, when supplied non-null, must
 * reference an ACTIVE profile whose role holds `query.manage` — assigning
 * a ticket to someone who structurally cannot manage queries would be a
 * dead end, and this is derived from the same permission-table data as
 * `listQueryManagers` below, never a hard-coded SUPPORT role or role-name
 * check (SYSTEM_PLAN.md §5).
 *
 * Phase 6.9: status changes and assignment changes are both named
 * explicitly in §32's audit list, so each is logged as its own
 * `audit_logs` row — `query.status.changed` / `query.assignment.changed` —
 * only when that specific field actually changes value (a PATCH that
 * re-sends the current status is a no-op, not an event), each carrying a
 * small `{ from, to }` metadata payload. Both writes share the same
 * transaction as the update itself, so a log entry can never be recorded
 * for a write that didn't happen, or vice versa.
 */
export async function updateAdminQuery(
  queryId: string,
  input: UpdateAdminQueryRequest,
  actorId: string,
  ipAddress: string | null = null,
): Promise<AdminQueryResponse> {
  const existing = await prisma.query.findUnique({ where: { id: queryId } });
  if (!existing) {
    throw new NotFoundError(`No query exists with id "${queryId}".`);
  }

  if (input.assigned_to !== undefined && input.assigned_to !== null) {
    const isQueryManager = await profileHoldsQueryManage(input.assigned_to);
    if (!isQueryManager) {
      throw new ValidationError({
        assigned_to: [
          `"${input.assigned_to}" is not an active user who holds the query.manage permission.`,
        ],
      });
    }
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const assignmentChanged =
    input.assigned_to !== undefined && input.assigned_to !== existing.assignedTo;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.query.update({
      where: { id: queryId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assigned_to !== undefined ? { assignedTo: input.assigned_to } : {}),
      },
      ...withAdminJoins,
    });

    if (statusChanged) {
      await recordAuditLog(
        {
          actorId,
          action: "query.status.changed",
          entityType: "query",
          entityId: queryId,
          metadata: { from: existing.status, to: input.status },
          ipAddress,
        },
        tx,
      );
    }

    if (assignmentChanged) {
      await recordAuditLog(
        {
          actorId,
          action: "query.assignment.changed",
          entityType: "query",
          entityId: queryId,
          metadata: { from: existing.assignedTo, to: input.assigned_to },
          ipAddress,
        },
        tx,
      );
    }

    return row;
  }, LONG_TRANSACTION_OPTIONS);

  return toAdminResponse(updated);
}

async function profileHoldsQueryManage(profileId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      status: true,
      role: { select: { rolePermissions: { select: { permission: { select: { code: true } } } } } },
    },
  });
  if (!profile || profile.status !== "ACTIVE") return false;
  return profile.role.rolePermissions.some((rp) => rp.permission.code === "query.manage");
}

/**
 * GET /api/v1/admin/queries/assignees (permission `query.manage`) — every
 * ACTIVE profile whose role holds `query.manage`, for the "Assign"
 * dropdown. Derived entirely from the existing
 * `roles` -> `role_permissions` -> `permissions` tables (SYSTEM_PLAN.md
 * §5) — no SUPPORT role, no role-name check; whichever role(s) a future
 * migration grants `query.manage` to appear here automatically.
 */
export async function listQueryManagers(): Promise<QueryManager[]> {
  const rows = await prisma.profile.findMany({
    where: {
      status: "ACTIVE",
      role: { rolePermissions: { some: { permission: { code: "query.manage" } } } },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return rows.map((row) => ({ id: row.id, full_name: row.fullName }));
}
