import { Link, useLocation } from "react-router-dom";
import type { SidebarNavItem } from "./Sidebar";

/**
 * Right-aligned breadcrumb from the reference designs ("Dashboard / Chapters"),
 * derived purely from the current URL and the shell's own nav items — the
 * longest matching nav item is the current page; the first item is the root.
 */
export function PageBreadcrumb({ items }: { items: SidebarNavItem[] }) {
  const { pathname } = useLocation();
  const root = items[0];
  if (!root) return null;

  const current = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex justify-end text-xs text-slate-500">
      <ol className="flex items-center gap-1.5">
        {current && current.to !== root.to ? (
          <>
            <li>
              <Link to={root.to} className="hover:text-indigo-900">
                {root.label}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-indigo-900">{current.label}</li>
          </>
        ) : (
          <li className="font-medium text-indigo-900">{root.label}</li>
        )}
      </ol>
    </nav>
  );
}
