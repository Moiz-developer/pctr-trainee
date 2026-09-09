import { z } from "zod";

// Treat an explicitly-empty value the same as "not set" — .env.example ships the
// Supabase variables as empty placeholders, and copying it to .env unedited should
// mean "not configured yet", not a validation failure.
const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalUrl = () => z.preprocess(emptyStringToUndefined, z.url().optional());
const optionalNonEmptyString = () =>
  z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

// A required URL with a sensible local-dev fallback: unlike the Supabase variables,
// this isn't tied to an unconfigured external service, so "" behaves like "use the
// default" rather than "not configured yet".
const urlWithDefault = (fallback: string) =>
  z.preprocess((value) => (value === "" || value === undefined ? fallback : value), z.url());

const envSchema = z.object({
  // ---- Not yet required: Supabase Auth is wired up in a later step ----
  VITE_SUPABASE_URL: optionalUrl(),
  VITE_SUPABASE_ANON_KEY: optionalNonEmptyString(),

  // ---- Required now (has a sensible local default; no API client exists yet this step) ----
  VITE_API_BASE_URL: urlWithDefault("http://localhost:4000"),
});

// Only these explicit, whitelisted keys are read from import.meta.env — never the
// whole object — so nothing beyond what's validated here can end up depended on.
const parsedEnv = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});

if (!parsedEnv.success) {
  console.error("[web] invalid environment configuration:", parsedEnv.error.flatten().fieldErrors);
  throw new Error(
    "Invalid environment configuration — check the field errors above against apps/web/.env.example.",
  );
}

export const env = parsedEnv.data;
export type Env = typeof env;

// Single source of truth for "has Supabase been configured yet." The Supabase Auth
// step should check this instead of re-deriving it from individual env fields.
export const isSupabaseConfigured: boolean =
  Boolean(env.VITE_SUPABASE_URL) && Boolean(env.VITE_SUPABASE_ANON_KEY);
