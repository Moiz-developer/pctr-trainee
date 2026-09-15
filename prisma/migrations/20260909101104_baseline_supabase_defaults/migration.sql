-- Baseline migration: records the extensions Supabase enables by default on
-- every new project, none of which this project created. This migration is
-- marked as already-applied via `prisma migrate resolve --applied` and is
-- NEVER executed — it exists only so Prisma Migrate's history matches the
-- database's actual pre-existing state before this project's first real
-- migration (identity_and_access) runs. See that migration's own header
-- comment and the Phase 1 Identity & Access implementation report for why
-- this was necessary.

-- Supabase creates its own extensions/vault schemas on every project; a fresh
-- database (e.g. Prisma's shadow database, CI, or a new environment) does
-- not have them yet, so this migration must create them itself to stay
-- portable and reproducible.
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE SCHEMA IF NOT EXISTS "vault";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions" VERSION "1.11";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions" VERSION "1.3";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog" VERSION "1.0";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault" VERSION "0.3.1";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions" VERSION "1.1";
