import { Prisma } from "../generated/prisma/client.js";
import { prisma, type PrismaTransactionClient } from "./prisma.js";

/**
 * Writer for `audit_logs` (SYSTEM_PLAN.md §14.9/§32). Generic and reusable —
 * not a Query-specific logger — so any future privileged action elsewhere in
 * the system calls this same function rather than a second logging
 * mechanism (Phase 6.9's own instruction: "do not create another
 * audit/logging system"). Never pass a password/token/secret in `metadata`:
 * §32 — "Never logs passwords, tokens, or secrets — only actor, action,
 * entity, and a small `metadata` JSON of non-sensitive before/after fields."
 */
export type AuditLogEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
};

/**
 * §32: "written synchronously, in the same transaction as the action where
 * feasible" — pass the same `tx` the calling code already has open (see
 * admin-queries.service.ts) to satisfy that; omit it to write standalone.
 * RLS's `audit_logs_insert` policy requires `actor_id = auth.uid()` (or
 * NULL), so this must run under the acting caller's own request context —
 * true by construction here, since every existing call site runs inside the
 * same `prisma`/`tx` client already bound to that request (lib/prisma.ts).
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  client: PrismaTransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? undefined,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
