import { LogOut, Menu } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../ui/Button";

/**
 * Reusable top bar primitive (DESIGN_NOTES.md / SYSTEM_PLAN.md §27, §34):
 * menu-toggle (mobile sidebar), page title, and sign-out. Shared by both
 * portal layouts.
 */
export function TopBar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { identity, signOut } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="cursor-pointer rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {identity.data && (
          <span className="hidden text-sm text-slate-500 sm:inline">{identity.data.fullName}</span>
        )}
        <Button variant="ghost" onClick={() => void signOut()} className="gap-2">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
