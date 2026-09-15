import type { LucideIcon } from "lucide-react";

/**
 * Structural placeholder for data-bearing areas that have no real data yet
 * (this unit deliberately implements no dashboard API — see the
 * implementation report). Not one of the eventual RemoteDataView states
 * (§34) — those apply once a screen actually fetches data; this is the
 * static Phase 1 stand-in for content that will exist from Phase 3 onward.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  );
}
