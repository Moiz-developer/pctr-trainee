import { Navigate, Outlet } from "react-router-dom";
import { useHasAdminAccess } from "./useHasAdminAccess";

/**
 * Route guard for the /admin/* tree (SYSTEM_PLAN.md §24). Assumes a session
 * and loaded identity already exist (mounted under RequireSession). UX-only
 * — bypassing this component grants no real access, since every /admin API
 * route independently requires its own specific permission (§10).
 */
export function RequireAdminAccess() {
  const hasAdminAccess = useHasAdminAccess();
  if (!hasAdminAccess) {
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}
