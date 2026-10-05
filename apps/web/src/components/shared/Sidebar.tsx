import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
/**
 * Static sidebar logo for now: the Excellium | Global Services mark
 * (public/brand/). Admin-uploaded logos (branding logoUrl) are not used here.
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
          className={`flex h-16 shrink-0 items-center border-b border-slate-100 px-4 ${
            collapsed ? "lg:px-2" : "lg:px-4"
          }`}
        >
          {/*
           * One logo at one size in both states: the image is a fixed 150px-wide box, sized so
           * "Excellium" alone fits the 54px collapsed window. The image uses object-contain
           * (aspect preserved), anchored at the left. Its viewport is 150px when expanded and
           * 54px when collapsed, so collapsing clips the right side while "Excellium" stays
           * put, and expanding reveals the rest from the right. Nothing is scaled or squeezed.
           * Mobile never collapses, so it always shows the full logo.
           */}
          <div
            className={`h-14 w-[150px] shrink-0 overflow-hidden ${
              collapsed ? "lg:w-[54px]" : ""
            }`}
          >
            <img
              src={SIDEBAR_LOGO_SRC}
              alt="Excellium | Global Services"
              draggable={false}
              className="block h-full w-[150px] max-w-none select-none object-contain object-left"
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
