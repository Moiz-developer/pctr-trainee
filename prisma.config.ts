// Prisma 7 configuration (replaces the legacy `datasource { url }` schema field).
// The connection URL here is used by Prisma's own tooling (migrate, studio, db pull) —
// it is separate from how PrismaClient itself connects at runtime, which uses an
// explicit driver adapter constructed in apps/api/src/lib/prisma.ts.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Omitted when DATABASE_URL is unset so `validate`/`generate` keep working without
  // real credentials (see STEP 0.6 report). Commands that need a live connection
  // (migrate, db pull, studio) will fail with a clear error until it is provided.
  ...(process.env.DATABASE_URL ? { datasource: { url: env("DATABASE_URL") } } : {}),
});
