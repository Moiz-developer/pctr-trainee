import { useState } from "react";

/**
 * Shared open/collapsed state for the shell: the header's hamburger collapses
 * the sidebar to an icon rail on desktop (>= lg) and opens/closes the
 * off-canvas overlay on smaller screens — one control, as in the PCTR
 * reference designs.
 */
export function useSidebarState() {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
