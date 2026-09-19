import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { ApiClientError } from "../../services/api/client";

/**
 * SYSTEM_PLAN.md §34: "loading (skeletons, not spincatch-alls), empty (icon +
 * message...), error (retry action)... via the same RemoteDataView-style
 * wrapper component around TanStack Query's states, so no screen is ever
 * left blank by omission." First unit to actually fetch real admin data
 * against a live list, so this is the first place it's needed — used by
 * every panel/page in this unit.
 */
export function RemoteDataView<T>({
  isLoading,
  isError,
  error,
  data,
  onRetry,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: (data: T) => ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-900" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (isError) {
    const message = error instanceof ApiClientError ? error.message : "Something went wrong.";
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-red-300" aria-hidden="true" />
        <p className="text-sm font-medium text-red-600">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 cursor-pointer text-sm font-medium text-indigo-700 hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (data === undefined) return null;

  if (isEmpty?.(data)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <Inbox className="h-6 w-6 text-indigo-300" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-slate-600">{emptyTitle}</p>
        {emptyDescription && <p className="text-xs text-slate-400">{emptyDescription}</p>}
      </div>
    );
  }

  return <>{children(data)}</>;
}
