import { Navigate } from "react-router-dom";
import { useHasAdminAccess } from "../authorization/useHasAdminAccess";

/** "/" -> the Admin Portal if the user holds any admin-tier permission, else the User Portal. */
export function RootRedirect() {
  const hasAdminAccess = useHasAdminAccess();
  return <Navigate to={hasAdminAccess ? "/admin" : "/app"} replace />;
}
