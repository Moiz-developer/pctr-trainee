import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "../components/ui/PageLoader";
import { useAuth } from "./useAuth";

/**
 * Route guard: no valid Supabase session -> redirect to /login (SYSTEM_PLAN.md
 * §24 "every /admin/* route requires a valid session", §25 similarly for
 * /app/*). Also waits for the /auth/me identity lookup so nested guards
 * (RequireAdminAccess, permission checks) have data to read. This is a
 * client-side UX convenience only — the API independently enforces the same
 * rule via requireAuth on every request (§10).
 */
export function RequireSession() {
  const { session, identity } = useAuth();
  const location = useLocation();

  if (session === undefined || (session && identity.isLoading)) {
    return <PageLoader fullScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (identity.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm font-medium text-slate-900">Unable to load your account.</p>
          <p className="mt-1 text-sm text-slate-500">{identity.error.message}</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
