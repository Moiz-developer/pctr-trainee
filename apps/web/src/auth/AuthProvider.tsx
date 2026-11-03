import { createContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Identity } from "@internal-training/shared";
import {
  getSession,
  onAuthStateChange,
  signOut as signOutRequest,
} from "../services/supabase/auth";
import { getMe } from "../services/api/auth";

export interface AuthContextValue {
  /** Supabase session, or `undefined` while the initial session lookup is in flight. */
  session: Session | null | undefined;
  /** GET /auth/me result for the current session (SYSTEM_PLAN.md §9/§26) — role, permissions, departments. */
  identity: UseQueryResult<Identity, Error>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Owns the Supabase session (SYSTEM_PLAN.md §9's frontend session handling)
 * and, once a session exists, the resulting `/auth/me` identity (role,
 * permissions, department memberships) used by every route guard and
 * permission check below. Frontend-only — never authoritative (§10).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let previousUserId: string | null | undefined;
    const updateSession = (next: Session | null) => {
      if (!active) return;
      const nextUserId = next?.user.id ?? null;
      if (previousUserId !== undefined && previousUserId !== nextUserId) {
        // Cancel in-flight queries and discard private data on account changes.
        queryClient.clear();
      }
      previousUserId = nextUserId;
      setSession(next);
    };
    getSession()
      .then((s) => {
        updateSession(s);
      })
      .catch(() => {
        updateSession(null);
      });
    const unsubscribe = onAuthStateChange((s) => {
      updateSession(s);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  const identity = useQuery({
    queryKey: ["auth", "me", session?.user.id],
    queryFn: getMe,
    enabled: !!session,
    retry: false,
    staleTime: 60_000,
  });

  const signOut = async () => {
    await signOutRequest();
  };

  return (
    <AuthContext.Provider value={{ session, identity, signOut }}>{children}</AuthContext.Provider>
  );
}
