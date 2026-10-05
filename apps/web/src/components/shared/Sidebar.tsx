import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

/**
 * Trimmed copy of the Excellium | Global Services logo (public/brand/). Served
 * as a static asset so the sidebar brand never depends on the branding settings.
 */
const SIDEBAR_LOGO_SRC = "/brand/excellium-global-services-logo.png";

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
          className="flex h-16 shrink-0 items-center border-b border-slate-100 px-4 lg:pl-[4px] lg:pr-0"
        >
          {/*
           * The logo is clipped, never scaled. Its width (and so the visible
           * window) changes between the full mark and just "Excellium" (the part
           * ending at ~63px of the 180px logo), while the image itself stays
           * left-anchored at a constant size. Expanding reveals the "| Global
           * Services" portion from the right; collapsing hides it toward the left.
           * Mobile always shows the full logo since the rail only exists on lg+.
           */}
          <div
            className={`shrink-0 overflow-hidden transition-[width] ${
              collapsed ? "w-[180px] lg:w-[64px]" : "w-[180px]"
            }`}
          >
            <img
              src={SIDEBAR_LOGO_SRC}
              alt="Excellium | Global Services"
              draggable={false}
              className="block h-auto w-[180px] max-w-none select-none"
            />
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
