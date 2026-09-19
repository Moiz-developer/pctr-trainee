import { useIsMutating } from "@tanstack/react-query";

/**
 * Site-wide top-of-viewport progress indicator, visible whenever any
 * mutation (create/update/delete request) is in flight anywhere in the app.
 * Driven entirely by TanStack Query's own `useIsMutating()` count — mounted
 * once at the app root (app/App.tsx), so it covers every existing and
 * future `useMutation` call with no per-action wiring.
 */
export function GlobalProgressBar() {
  const mutatingCount = useIsMutating();
  if (mutatingCount === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Request in progress"
      className="fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-indigo-100"
    >
      <div className="h-full w-1/3 animate-[global-progress-bar_1.1s_ease-in-out_infinite] bg-indigo-600" />
    </div>
  );
}
