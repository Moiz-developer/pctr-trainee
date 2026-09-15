import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

/**
 * Phase 2H (RLS + non-bypassing DB role). A separate, privileged Prisma
 * Client for operator-run tooling ONLY — `db/seed.ts` and `db/seed-demo.ts`.
 * Connects via `env.DATABASE_URL` (the original `postgres` role), which
 * still bypasses RLS deliberately: seed scripts are run manually by an
 * operator, outside any authenticated request, and legitimately need to
 * write baseline roles/permissions and demo data regardless of row-level
 * ownership. `lib/prisma.ts` (the API's runtime client, connected as the
 * new non-bypassing `app_api` role) is NOT usable here — with no request
 * context, every RLS-protected table would simply reject every write.
 */
export const prismaPrivileged: PrismaClient = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
});
