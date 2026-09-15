import { z } from "zod";

// Treat an explicitly-empty value the same as "not set" — .env.example ships these
// infrastructure credentials as empty placeholders (e.g. `SUPABASE_URL=`), and copying
// it to .env unedited should mean "not configured yet", not a validation failure.
const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalNonEmptyString = () =>
  z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const envSchema = z.object({
  // ---- Required now ----
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.coerce.number().int().positive().default(4000),

  // Comma-separated list of allowed browser origins, e.g. "http://localhost:5173,https://app.example.com".
  // No wildcard fallback: an origin not in this list is not granted CORS access.
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  // ---- Server-only infrastructure credentials ----
  // Each remaining `optional*()` field stays optional because the feature that needs
  // it isn't wired in yet, and this module's validation must not prevent the API (and
  // its health checks) from starting before real credentials exist. When the owning
  // feature is implemented, remove `.optional()` from that field — there is no second
  // config path to update; this file stays the single source of truth for server-side
  // config.

  // Prisma CLI tooling (migrate/studio/db pull) reads this independently via
  // prisma.config.ts at the repo root — see STEP 0.6. Also used directly by
  // lib/prisma-privileged.ts (seed scripts only) — the privileged `postgres`
  // role, which bypasses RLS. The API's own runtime connection uses
  // RUNTIME_DATABASE_URL instead (see below) — never this one.
  DATABASE_URL: optionalNonEmptyString(),

  // Required as of Phase 2H (RLS + non-bypassing DB role): lib/prisma.ts's
  // runtime client connects as `app_api` (NOBYPASSRLS, created by the
  // enable_rls migration), never as the privileged `postgres` role DATABASE_URL
  // points at — so every query the running API issues is actually subject to
  // Postgres RLS, not silently exempt from it (SYSTEM_PLAN.md §1 Pillar 2 /
  // §12/§13).
  RUNTIME_DATABASE_URL: z.string().min(1),

  // Required as of the authentication/authorization foundation unit: modules/auth/jwt.ts
  // fetches this project's JWKS endpoint (SUPABASE_URL + "/auth/v1/.well-known/jwks.json")
  // to verify asymmetric-algorithm tokens — the default for current Supabase projects
  // (confirmed empirically: this project's tokens are ES256, not HS256).
  SUPABASE_URL: z.url(),

  // Required as of the admin-user-provisioning unit: lib/supabase-admin.ts uses this to
  // create/update/delete Supabase Auth users (POST/PATCH /api/v1/admin/users). Never
  // sent to the browser, never logged.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Optional: only consulted for tokens whose header declares alg=HS256 (legacy
  // Supabase projects using a shared secret instead of JWKS). Not required for THIS
  // project, which uses ES256/JWKS exclusively, but kept for portability — see
  // modules/auth/jwt.ts.
  SUPABASE_JWT_SECRET: optionalNonEmptyString(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("[api] invalid environment configuration:", parsedEnv.error.flatten().fieldErrors);
  throw new Error(
    "Invalid environment configuration — check the field errors above against apps/api/.env.example.",
  );
}

export const env = parsedEnv.data;
export type Env = typeof env;
