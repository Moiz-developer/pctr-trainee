import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

/**
 * Thin wrappers around the three frontend auth responsibilities named by
 * SYSTEM_PLAN.md §9: sign-in, sign-out, and session/JWT refresh (handled
 * automatically by the Supabase client once a session exists). No UI/routes
 * consume these yet — see this unit's implementation report.
 */

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}
