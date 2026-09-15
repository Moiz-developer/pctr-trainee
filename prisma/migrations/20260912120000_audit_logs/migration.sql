-- Phase 6.9 — Query Audit Logging (SYSTEM_PLAN.md §14.9/§32). Introduces
-- `audit_logs` — the plan has specified this table's field set since
-- §14.9/§32, but no earlier phase created it yet. This is the canonical,
-- generic table (not a Query-specific one): actor_id (nullable — a future
-- system-initiated action has no acting user), action (dotted verb string,
-- e.g. `query.status.changed`), entity_type + entity_id (what the action
-- was performed on), metadata (small non-sensitive before/after JSON),
-- ip_address, created_at. Hand-written (not `prisma migrate dev`) per this
-- project's established shadow-DB workaround — see other migrations'
-- headers for why. Table/column/constraint names match Prisma's own
-- generated-SQL conventions, verified against schema.prisma.

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: append-only. INSERT is checked against the caller's own identity —
-- actor_id must equal auth.uid(), or be NULL for a (future) system-
-- initiated write — the same anti-impersonation shape as every other
-- *_insert policy keyed off auth.uid() in this project (e.g. queries_insert,
-- 20260911150000_query_support). No SELECT/UPDATE/DELETE policy exists:
-- there is no update/delete relation on this model at all (append-only, same
-- precedent as query_messages/query_attachments), and no read endpoint
-- exists yet either — an "Admin Audit Log" viewer is a future phase (§24) —
-- so leaving SELECT unpoliced (and therefore fully denied by RLS's own
-- default-deny) is the correct, fail-closed default until that phase
-- defines who may read it. Widening later is a single ALTER POLICY, the
-- same bridge pattern used throughout this project — never a narrowing.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (
  actor_id = auth.uid() OR actor_id IS NULL
);
