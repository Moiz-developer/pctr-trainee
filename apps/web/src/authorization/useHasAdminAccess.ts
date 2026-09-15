import { useAuth } from "../auth/useAuth";

/**
 * Whether the current user should see the Admin Portal shell at all
 * (SYSTEM_PLAN.md §24: "wrapped by a route-level check for at least one
 * admin-tier permission (client-side UX only)"). The plan doesn't name a
 * single "admin-tier" permission — but every permission the seed defines
 * (`user.*`, `department.manage`, `course.*`, `announcement.publish`, ...)
 * IS an admin-tier action, and TRAINER_USER holds none of them (§5's seed).
 * So "holds at least one permission" is exactly that check, expressed
 * without any role-name comparison — it generalizes correctly if a future
 * partial-admin role is introduced.
 */
export function useHasAdminAccess(): boolean {
  const { identity } = useAuth();
  return (identity.data?.permissions.length ?? 0) > 0;
}
