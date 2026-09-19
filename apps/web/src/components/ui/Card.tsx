import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The card treatments from the PCTR redesign references: a white content card
 * with a soft shadow (optionally with a bordered `CardHeader` row) and a solid
 * brand-indigo "stat" card with an amber corner accent. `flush` removes the
 * padding so media/headers can run edge to edge.
 */
export function Card({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={`rounded-lg bg-white shadow-[0_1px_4px_rgba(49,44,133,0.10)] ${
        flush ? "overflow-hidden" : "p-6"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Bordered card title row (title left, optional action right). Use inside a `flush` Card. */
export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
      <h3 className="text-sm font-semibold text-indigo-950">{title}</h3>
      {action}
    </div>
  );
}

export function StatCard({
  children,
  className = "",
  icon: Icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-indigo-900 p-6 text-white shadow-[0_2px_8px_rgba(49,44,133,0.25)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-accent"
      />
      {Icon && (
        <Icon
          className="pointer-events-none absolute bottom-4 right-5 h-14 w-14 text-white/20"
          aria-hidden="true"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
