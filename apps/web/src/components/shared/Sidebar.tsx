import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Reusable sidebar primitive (DESIGN_NOTES.md / SYSTEM_PLAN.md §27 layouts/,
 * §34): fixed-width on desktop; off-canvas overlay on small screens,
 * controlled by `isOpen`/`onClose` so AdminLayout and UserPortalLayout can
 * share one implementation instead of duplicating the active-pill nav
 * styling per portal.
 */
export function Sidebar({
  brand,
  items,
  isOpen,
  onClose,
}: {
  brand: string;
  items: SidebarNavItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white transition-transform lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-6 text-lg font-semibold text-indigo-900">
          {brand}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-indigo-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
