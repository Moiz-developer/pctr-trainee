import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/**
 * Server-only Supabase Admin client (service-role key). Used exclusively for
 * Supabase Auth user provisioning (invite/update/delete) — see
 * modules/users/users.service.ts. Never imported by frontend code; the
 * service-role key never leaves this process (SYSTEM_PLAN.md §7/§9/§36).
 */
const globalForSupabaseAdmin = globalThis as unknown as { supabaseAdmin?: SupabaseClient };

export function getSupabaseAdmin(): SupabaseClient {
  const existing = globalForSupabaseAdmin.supabaseAdmin;
  if (existing) {
    return existing;
  }
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (env.NODE_ENV !== "production") {
    globalForSupabaseAdmin.supabaseAdmin = client;
  }
  return client;
}
