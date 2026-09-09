import { z } from "zod";

// Treat an explicitly-empty value the same as "not set" — .env.example ships these
// infrastructure credentials as empty placeholders (e.g. `SUPABASE_URL=`), and copying
// it to .env unedited should mean "not configured yet", not a validation failure.
const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalUrl = () => z.preprocess(emptyStringToUndefined, z.url().optional());
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

  // ---- Server-only infrastructure credentials (not yet required) ----
  // Each is optional today because the feature that needs it isn't wired in yet, and
  // this module's validation must not prevent the API (and its health checks) from
  // starting before real credentials exist. When the owning feature is implemented,
  // remove `.optional()` from that field below — there is no second config path to
  // update; this file stays the single source of truth for server-side config.

  // Consumed by apps/api/src/lib/prisma.ts once wired into a route. Prisma's own CLI
  // tooling (migrate/studio/db pull) reads the same DATABASE_URL independently via
  // prisma.config.ts at the repo root — see STEP 0.6.
  DATABASE_URL: optionalNonEmptyString(),

  // Becomes required in the Supabase integration step (Auth/Storage).
  SUPABASE_URL: optionalUrl(),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString(),
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

// Single source of truth for "has Supabase been configured yet." Later steps (Auth,
// Storage) should check this instead of re-deriving it from individual env fields.
export const isSupabaseConfigured: boolean =
  Boolean(env.SUPABASE_URL) &&
  Boolean(env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(env.SUPABASE_JWT_SECRET);
