-- Query Category dropdown unit. Adds an admin-managed `query_categories`
-- lookup table, mirroring `resource_categories`
-- (20260913090000_resources/migration.sql) field-for-field, and a nullable
-- `queries.category_id` FK to it. The existing free-text `queries.category`
-- column is deliberately KEPT (not dropped, not renamed) so every existing
-- query row remains fully readable/compatible — new tickets stop writing
-- it, but nothing about it changes here. Hand-written (not `prisma migrate
-- dev`), per this project's established shadow-DB workaround — see other
-- migrations' headers.

-- CreateTable
CREATE TABLE "query_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "query_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "query_categories_name_key" ON "query_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "query_categories_slug_key" ON "query_categories"("slug");

-- AlterTable: add the new nullable FK alongside the existing legacy column.
ALTER TABLE "queries" ADD COLUMN "category_id" UUID;

-- CreateIndex
CREATE INDEX "queries_category_id_idx" ON "queries"("category_id");

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "query_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one query_categories row per distinct existing non-blank
-- queries.category value. There is no slugify() helper anywhere in this
-- codebase (Course/Resource category slugs are always admin-typed at
-- creation, never derived) — this deterministic lowercase/hyphenate
-- expression is a one-time backfill concern only, not a reusable function.
-- `ON CONFLICT DO NOTHING` (no target listed, so it catches either the
-- name or the slug unique constraint) skips a distinct-but-differently-cased
-- value that happens to normalize to an already-inserted slug (e.g.
-- "Billing" and "billing" both -> "billing") — safe, since the row for the
-- first-seen spelling still gets created; the exact-match link step below
-- only links rows whose (trimmed) text matches a category_categories.name
-- exactly, so this is a documented, intentionally conservative limitation,
-- not a bug.
INSERT INTO "query_categories" ("id", "name", "slug", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  distinct_category,
  trim(both '-' from regexp_replace(lower(distinct_category), '[^a-z0-9]+', '-', 'g')),
  true,
  now(),
  now()
FROM (
  SELECT DISTINCT trim("category") AS distinct_category
  FROM "queries"
  WHERE "category" IS NOT NULL AND trim("category") <> ''
) AS distinct_categories
ON CONFLICT DO NOTHING;

-- Link existing queries to their newly-backfilled category "where safely
-- possible" (this unit's own instruction) — an EXACT trimmed-text match
-- only, never a fuzzy one. A query whose category text didn't get its own
-- row above (the case-collision scenario noted above) simply stays
-- unlinked (category_id remains NULL); its legacy `category` text is
-- untouched and still displayed as a fallback by the application layer.
UPDATE "queries" q
SET "category_id" = qc."id"
FROM "query_categories" qc
WHERE q."category_id" IS NULL
  AND q."category" IS NOT NULL
  AND trim(q."category") = qc."name";

-- RLS: mirrors resource_categories' policy shape exactly (any authenticated
-- user may read — needed both by the trainee create-form dropdown and by
-- admin management; writes gated by query.manage, the one permission the
-- whole Query/Support feature is already gated by).
ALTER TABLE "query_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY query_categories_select ON query_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY query_categories_insert ON query_categories FOR INSERT WITH CHECK (has_permission('query.manage'));
CREATE POLICY query_categories_update ON query_categories FOR UPDATE USING (has_permission('query.manage')) WITH CHECK (has_permission('query.manage'));
