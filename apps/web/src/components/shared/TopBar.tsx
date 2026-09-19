import { LogOut, Menu } from "lucide-react";
import { useAuth } from "../../auth/useAuth";

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}

/**
 * Reusable top bar primitive (DESIGN_NOTES.md / SYSTEM_PLAN.md §27, §34):
 * PCTR indigo header with the sidebar toggle on the left and the signed-in
 * user + sign-out on the right. Shared by both portal layouts.
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { identity, signOut } = useAuth();
  const fullName = identity.data?.fullName;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-indigo-900 px-4 text-white shadow-sm sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="cursor-pointer rounded-md p-2 text-white/90 transition-colors hover:bg-white/10"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3">
        {fullName && <span className="hidden text-sm text-white/90 sm:inline">{fullName}</span>}
        {fullName && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-white text-xs font-semibold text-indigo-900"
            aria-hidden="true"
          >
            {initialsOf(fullName)}
          </span>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
