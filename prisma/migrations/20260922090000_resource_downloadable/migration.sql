-- Business Analysis Templates unit: an admin-set flag on a resource that
-- shows a Download button in the trainee portal, reusing the existing
-- authorized GET /media/:id/access-url signed-URL flow (no new access path,
-- no bucket/policy change). Hand-written (not `prisma migrate dev`), per
-- this project's established shadow-DB workaround — see other migrations'
-- headers. Purely additive: a NOT NULL column with a `false` default, so
-- every existing resource keeps today's view-only behavior unchanged.
--
-- Presentational only — does not touch resources_select or
-- media_assets_select RLS, since it changes what the trainee UI OFFERS to
-- do with a file the caller is already authorized to view, not who can
-- read the resource row or request a signed URL for its file.

-- AlterTable
ALTER TABLE "resources" ADD COLUMN "is_downloadable" BOOLEAN NOT NULL DEFAULT false;
