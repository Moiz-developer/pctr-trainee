import { z } from "zod";

// A required URL with a sensible local-dev fallback: unlike the Supabase variables,
// this isn't tied to an unconfigured external service, so "" behaves like "use the
// default" rather than "not configured yet".
const urlWithDefault = (fallback: string) =>
  z.preprocess((value) => (value === "" || value === undefined ? fallback : value), z.url());

const envSchema = z.object({
  // Required as of the authentication foundation unit: the browser Supabase client
  // (services/supabase/client.ts) is constructed from these at module load.
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),

  // Required, with a sensible local default (no API client exists yet this step).
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
