import type { ReactNode } from "react";

/** Layout for unauthenticated routes (SYSTEM_PLAN.md §27 layouts/ "AuthLayout"). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
