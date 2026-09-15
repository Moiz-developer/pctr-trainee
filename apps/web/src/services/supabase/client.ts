import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

/**
 * Browser Supabase client (SYSTEM_PLAN.md §7): used for exactly one purpose
 * — authentication (sign-in, sign-out, session/JWT refresh) — via the public
 * anon key. Never used for direct table or Storage access; all business data
 * goes through the Express API.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
