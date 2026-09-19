import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { getCurrentUserId } from "./request-context.js";

/**
 * Phase 2H (RLS + non-bypassing DB role). This is the API's runtime
 * database connection — deliberately NOT `env.DATABASE_URL` (that stays the
 * privileged `postgres` role, used only by `prisma migrate`/`prisma
 * generate` tooling and by the dedicated seed-script client,
 * `lib/prisma-privileged.ts`). This connects as `app_api`, a role created
 * by the `enable_rls` migration with `NOBYPASSRLS` and only the DML
 * privileges it needs — so every query issued through this client is
 * actually subject to Postgres RLS, not silently exempt from it.
 *
 * Query extension: every operation is wrapped in a two-statement
 * transaction — `SELECT set_config('request.jwt.claim.sub', <user id>,
 * TRUE)` followed by the real query — using the current request's
 * authenticated user id from `request-context.ts` (populated once, in
 * `auth.middleware.ts`, right after JWT verification). This is the exact
 * GUC Supabase's own `auth.uid()` reads (`select
 * nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`), so
 * every RLS policy written against `auth.uid()` sees the real caller —
 * without any of the ~10 existing service files needing to change how they
 * import or call `prisma`. `set_config(..., TRUE)` is transaction-local
 * (`SET LOCAL` semantics): it cannot leak to a different request that later
 * reuses the same pooled connection, verified empirically (20 concurrent
 * interleaved calls as different users, zero cross-contamination) before
 * this was wired in — see this unit's implementation report.
 *
 * When no request context exists (e.g. this process's own non-request
 * code), the query runs with no `auth.uid()` — every policy treats that as
 * "show nothing," fail-closed by construction, never "show everything."
 */
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

function createBaseClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.RUNTIME_DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });
}

function createPrismaClient() {
  const base = createBaseClient();
  return base.$extends({
    name: "rls-request-context",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const userId = getCurrentUserId();
          if (!userId) {
            return query(args);
          }
          const [, result] = await base.$transaction(
            [
              base.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${userId}, TRUE)`,
              query(args),
            ],
            // Prisma's default maxWait (2s) is too short when the pooled remote
            // Postgres connection must be (re)established: the first request
            // after a cold start/idle period failed with P2028 ("Unable to
            // start a transaction in the given time") and surfaced as a
            // generic 500.
            { maxWait: 10_000, timeout: 15_000 },
          );
          return result;
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * The type of `tx` inside `prisma.$transaction(async (tx) => ...)` on THIS
 * (RLS-extended) client — not `Prisma.TransactionClient` (the generated
 * type for the unextended base client), which is structurally incompatible
 * with the extended client's own `$transaction` overload. Extracted via
 * conditional-type inference against the interactive-transaction overload
 * shape, since `typeof prisma.$transaction` itself is ambiguous (overloaded
 * with the array-form transaction). Phase 3's course_progress/
 * training_sessions transaction helpers (course-progress.service.ts,
 * training-sessions.service.ts) take this type, not `Prisma.TransactionClient`.
 */
export type PrismaTransactionClient = typeof prisma extends {
  $transaction(fn: (client: infer TxClient) => unknown, ...rest: never[]): unknown;
}
  ? TxClient
  : never;

/**
 * Shared `{ timeout }` override for any interactive transaction that, like
 * `progress.service.ts`'s `upsertLessonProgress`, issues several round trips
 * (each individually doubled by this file's RLS extension). Raised from
 * Prisma's 5s default after this was observed to fail against a remote
 * pooled connection (P2028 "commit on an expired transaction") — see that
 * function's own comment for the original finding. Reused as-is by
 * assessment-attempts.service.ts's submit/grade transactions, which do
 * comparable bounded work per call.
 */
export const LONG_TRANSACTION_OPTIONS = { timeout: 15_000 };
