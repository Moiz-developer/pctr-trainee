import type { ReactNode } from "react";
import { EyeOff } from "lucide-react";

/**
 * Shown for training files that can't be rendered inside the portal. There is
 * deliberately no download fallback: protected content is viewable in-portal
 * only, so an unsupported type is reported as unavailable instead.
 */
export function PreviewUnavailable({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-600">{children}</p>
    </div>
  );
}
