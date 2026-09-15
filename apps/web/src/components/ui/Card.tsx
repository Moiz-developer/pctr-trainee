import type { ReactNode } from "react";

/**
 * The two card treatments named by DESIGN_NOTES.md (from the "panel-design.png"
 * reference, per SYSTEM_PLAN.md §34): a solid brand-color "stat" card and a
 * plain white content card. Kept to exactly these two variants.
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`rounded-xl bg-indigo-900 p-6 text-white ${className}`}>{children}</div>;
}
