import { useAuth } from "../auth/useAuth";

/**
 * SYSTEM_PLAN.md §5/§10: permission-code check, never a role-name check.
 * Frontend-only UX guard — the API independently re-checks every permission
 * server-side (§10) regardless of what this hook returns.
 */
export function usePermission(code: string): boolean {
  const { identity } = useAuth();
  return identity.data?.permissions.includes(code) ?? false;
}
