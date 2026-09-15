-- Phase 6 (database only): Query/Support (SYSTEM_PLAN.md §14.7/§22).
-- Hand-written (not `prisma migrate dev`) per this project's established
-- shadow-DB workaround — see other migrations' headers for why.
-- Table/column/constraint names below match Prisma's own generated-SQL
-- conventions, verified against schema.prisma.

-- CreateEnum
CREATE TYPE "query_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "query_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESPONDED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "queries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "course_id" UUID,
    "priority" "query_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "query_status" NOT NULL DEFAULT 'OPEN',
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queries_user_id_status_idx" ON "queries"("user_id", "status");

-- CreateIndex
CREATE INDEX "queries_status_idx" ON "queries"("status");

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "query_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "query_id" UUID NOT NULL,
    "sender_id" UUID,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "query_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "query_messages_query_id_created_at_idx" ON "query_messages"("query_id", "created_at");

-- AddForeignKey
ALTER TABLE "query_messages" ADD CONSTRAINT "query_messages_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_messages" ADD CONSTRAINT "query_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "query_attachments" (
    "query_message_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,

    CONSTRAINT "query_attachments_pkey" PRIMARY KEY ("query_message_id","media_asset_id")
);

-- AddForeignKey
ALTER TABLE "query_attachments" ADD CONSTRAINT "query_attachments_query_message_id_fkey" FOREIGN KEY ("query_message_id") REFERENCES "query_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_attachments" ADD CONSTRAINT "query_attachments_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: extends this project's established per-table policy set (Phase 2H's
-- enable_rls migration, and every phase since) with the same conventions.
-- §22: "A user can only ever see/query queries where user_id = self (both
-- API filter and RLS policy); support-permission holders ... see all" —
-- `query.manage` (already seeded, §26's own endpoint table names it for
-- `GET /admin/queries`) is that support/admin permission. `query_messages`
-- is an append-only conversation thread (no UPDATE/DELETE policy anywhere,
-- same append-only reasoning already applied to `audit_logs`, §14.9).

-- queries (read/insert: ticket owner or query.manage; update — status/assignment changes — query.manage only, mirroring course_access_update's admin-only write shape)
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY queries_select ON queries FOR SELECT USING (
  user_id = auth.uid() OR has_permission('query.manage')
);
CREATE POLICY queries_insert ON queries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY queries_update ON queries FOR UPDATE USING (has_permission('query.manage')) WITH CHECK (has_permission('query.manage'));

-- query_messages (read/insert via the owning query's owner, or query.manage; append-only — no update/delete policy)
ALTER TABLE query_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY query_messages_select ON query_messages FOR SELECT USING (
  has_permission('query.manage')
  OR EXISTS (SELECT 1 FROM queries q WHERE q.id = query_messages.query_id AND q.user_id = auth.uid())
);
CREATE POLICY query_messages_insert ON query_messages FOR INSERT WITH CHECK (
  has_permission('query.manage')
  OR EXISTS (SELECT 1 FROM queries q WHERE q.id = query_messages.query_id AND q.user_id = auth.uid())
);

-- query_attachments (read/insert via the owning message's query owner, or query.manage; same join-one-level-deeper shape as assessment_question_options)
ALTER TABLE query_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY query_attachments_select ON query_attachments FOR SELECT USING (
  has_permission('query.manage')
  OR EXISTS (
    SELECT 1 FROM query_messages qm
    JOIN queries q ON q.id = qm.query_id
    WHERE qm.id = query_attachments.query_message_id AND q.user_id = auth.uid()
  )
);
CREATE POLICY query_attachments_insert ON query_attachments FOR INSERT WITH CHECK (
  has_permission('query.manage')
  OR EXISTS (
    SELECT 1 FROM query_messages qm
    JOIN queries q ON q.id = qm.query_id
    WHERE qm.id = query_attachments.query_message_id AND q.user_id = auth.uid()
  )
);
