import type { ReactNode } from "react";
import { usePermission } from "./usePermission";

/**
 * SYSTEM_PLAN.md §27: "<Can permission=\"course.create\"> guard component
 * (UX-only, documented as such)". Hides `children` when the current user
 * lacks the given permission. This is presentation only — every action it
 * gates is independently re-checked server-side (§10); removing/bypassing
 * this component can never grant real access.
 */
export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;
  return <>{children}</>;
}
