import { Star, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useBranding } from "./useBranding";

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Reusable sidebar primitive (DESIGN_NOTES.md / SYSTEM_PLAN.md §27 layouts/,
 * §34): white rail with the PCTR brand strip and rounded indigo active
 * items; fixed-width (or icon-only when `collapsed`) on desktop, off-canvas
 * overlay on small screens, controlled by `isOpen`/`onClose` so AdminLayout
 * and UserPortalLayout share one implementation.
 */
export function Sidebar({
  brand,
  items,
  isOpen,
  collapsed = false,
  onClose,
}: {
  brand: string;
  items: SidebarNavItem[];
  isOpen: boolean;
  collapsed?: boolean;
  onClose: () => void;
}) {
  const { platformName, logoUrl } = useBranding();
  // Labels stay visible in the mobile overlay; only the desktop rail hides them.
  const hideOnRail = collapsed ? "lg:hidden" : "";

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
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col bg-white shadow-[1px_0_0_rgba(49,44,133,0.06)] transition-all lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          collapsed ? "lg:w-[68px]" : "lg:w-60"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 ${
            collapsed ? "lg:justify-center lg:px-0" : ""
          }`}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
          ) : (
            <Star className="h-7 w-7 shrink-0 fill-indigo-900 text-indigo-900" aria-hidden="true" />
          )}
          <div className={`min-w-0 leading-tight ${hideOnRail}`}>
            <p className="truncate text-base font-bold tracking-tight text-indigo-900">
              {platformName ?? "PCTR"}
            </p>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
              {brand}
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  isActive
                    ? "bg-indigo-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className={`truncate ${hideOnRail}`}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
