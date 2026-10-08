import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useBranding } from "./useBranding";

/**
 * Built-in defaults (Sidebar branding unit), used whenever the admin hasn't
 * uploaded a sidebar-specific override in Settings → Branding. Independent
 * of the Platform Logo — see useBranding.ts's sidebarExpandedLogoUrl/
 * sidebarCollapsedLogoUrl doc comment.
 */
const DEFAULT_EXPANDED_LOGO_SRC = "/brand/excellium-sidebar-logo-expanded.png";
const DEFAULT_COLLAPSED_LOGO_SRC = "/brand/excellium-sidebar-logo-collapsed.png";

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
  const { platformName, sidebarExpandedLogoUrl, sidebarCollapsedLogoUrl } = useBranding();
  const expandedLogoSrc = sidebarExpandedLogoUrl ?? DEFAULT_EXPANDED_LOGO_SRC;
  const collapsedLogoSrc = sidebarCollapsedLogoUrl ?? DEFAULT_COLLAPSED_LOGO_SRC;
  const expandedLogoAlt = platformName ? `${platformName} logo` : "Excellium Global Services";
  const collapsedLogoAlt = platformName ? `${platformName} icon` : "Excellium";

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
        <div className="relative h-16 shrink-0 border-b border-slate-100">
          {/*
           * Two independent, admin-configurable logos (Sidebar branding unit — see
           * useBranding.ts), each its own fixed image, never scaled/stretched/cropped against
           * the other. They're layered (absolute, same box) and crossfade: the expanded logo
           * additionally clip-reveals from the left edge outward, so expanding reads as "the
           * rest of the logo grows in from the right" and collapsing as "the right side
           * recedes" rather than a flat swap, while the collapsed icon fades in/out in place.
           * Synced to the sidebar's own width transition's duration; prefers-reduced-motion
           * drops straight to the end state with no animation at all. Mobile never collapses
           * (every collapsed-only rule below is lg:-scoped), so it always shows the full logo.
           *
           * Sizing: the image fills nearly the full 64px row height (h-[60px], 2px breathing
           * room top/bottom) inside 12px side padding — the max this row can give it. This is
           * genuinely the full available box, not a number tuned for one specific logo:
           * object-contain scales within it by the IMAGE's OWN aspect ratio, so a tightly
           * cropped upload (no padding) fills that box; a logo stored on an oversized/padded
           * canvas (e.g. a square PNG around a wide wordmark) still renders small here, because
           * its own file reports a ~1:1 aspect ratio — that's the file's content, not something
           * this component can discard without cropping the admin's actual artwork, which
           * nothing here does. See BrandingSettingsCard.tsx's hint text for the admin-facing
           * guidance (upload a tightly cropped image) that actually fixes that case.
           */}
          <div
            className={`absolute inset-0 flex items-center overflow-hidden px-3 opacity-100 transition-[clip-path,opacity] duration-200 ease-out [clip-path:inset(0_0%_0_0)] motion-reduce:transition-none ${
              collapsed ? "lg:opacity-0 lg:[clip-path:inset(0_100%_0_0)]" : ""
            }`}
            aria-hidden={collapsed || undefined}
          >
            <img
              src={expandedLogoSrc}
              alt={expandedLogoAlt}
              draggable={false}
              className="h-[60px] max-w-full select-none object-contain object-left"
            />
          </div>
          <div
            className={`absolute inset-0 hidden items-center justify-center opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none lg:flex ${
              collapsed ? "lg:opacity-100" : ""
            }`}
            aria-hidden={!collapsed || undefined}
          >
            <img
              src={collapsedLogoSrc}
              alt={collapsedLogoAlt}
              draggable={false}
              className="h-11 w-11 max-w-[44px] select-none object-contain"
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
