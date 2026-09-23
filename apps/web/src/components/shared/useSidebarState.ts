import { useState } from "react";

/**
 * Shared open/collapsed state for the shell: the header's hamburger collapses
 * the sidebar to an icon rail on desktop (>= lg) and opens/closes the
 * off-canvas overlay on smaller screens — one control, as in the PCTR
 * reference designs.
 *
 * `collapseByDefaultQuery` (optional): a media query the sidebar should start
 * collapsed under, instead of the usual always-expanded default — e.g. the
 * trainer dashboard's ~1280–1790px range, where its own two-column split
 * (stat cards + "Continue Learning" panel) already leaves little room, and a
 * full-width expanded sidebar on top of that was the reported cramped range.
 * Checked once, at mount, the same one-shot way `toggle()` below already
 * checks `window.matchMedia` — not a live-resize listener, so this only ever
 * affects the sidebar's state on load, never mid-session, and the trainer can
 * still expand or re-collapse it manually via the existing toggle at any
 * width, exactly as before.
 */
export function useSidebarState(options?: { collapseByDefaultQuery?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    options?.collapseByDefaultQuery
      ? window.matchMedia(options.collapseByDefaultQuery).matches
      : false,
  );

  return {
    isOpen,
    collapsed,
    close: () => setIsOpen(false),
    toggle: () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setCollapsed((current) => !current);
      } else {
        setIsOpen((current) => !current);
      }
    },
  };
}
