-- Useful Links unit (Resources). Allows a Resource to be backed by an
-- external URL instead of an uploaded file, alongside every existing
-- file-backed resource unchanged. Hand-written (not `prisma migrate dev`),
-- per this project's established shadow-DB workaround — see other
-- migrations' headers.

-- media_asset_id becomes optional: a URL-backed resource has no attached
-- file. The existing FK constraint (resources_media_asset_id_fkey,
-- ON DELETE RESTRICT) is unaffected — a nullable FK column simply allows
-- NULL, every existing non-null value is untouched.
ALTER TABLE "resources" ALTER COLUMN "media_asset_id" DROP NOT NULL;

-- AddColumn
ALTER TABLE "resources" ADD COLUMN "external_url" TEXT;

-- Exactly one of media_asset_id/external_url must be set — "a resource must
-- have either a file/media asset OR an external URL", not both, not
-- neither. Not expressible in Prisma's schema DSL — added here directly,
-- same precedent as training_hour_requirements_scope_check
-- (20260911130000_training_progress_hours/migration.sql).
ALTER TABLE "resources" ADD CONSTRAINT "resources_media_or_url_check" CHECK (
  num_nonnulls("media_asset_id", "external_url") = 1
);
