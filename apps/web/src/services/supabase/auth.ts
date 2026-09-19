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

/**
 * Password reset, step 1: asks Supabase Auth to email a recovery link. The
 * link returns the user to `/reset-password` with a recovery session that the
 * existing Supabase client picks up automatically. `redirectTo` must be in the
 * project's allowed Auth redirect URLs. Supabase reports success whether or
 * not the address is registered, so callers must not imply either.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    throw error;
  }
}

/** Password reset, step 2: sets a new password for the current (recovery) session. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw error;
  }
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
