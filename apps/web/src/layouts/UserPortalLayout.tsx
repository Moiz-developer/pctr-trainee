import { Outlet } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
} from "lucide-react";
import { Sidebar, type SidebarNavItem } from "../components/shared/Sidebar";
import { useSidebarState } from "../components/shared/useSidebarState";
import { TopBar } from "../components/shared/TopBar";
import { PageBreadcrumb } from "../components/shared/PageBreadcrumb";
import { useBranding } from "../components/shared/useBranding";
import { PortalAnnouncementPopup } from "../pages/portal/announcements/PortalAnnouncementPopup";

// Only routes that actually exist (see prior units' implementation
// reports). Labels/order match the original required Trainer Portal
// navigation exactly (sidebar audit, this unit): Dashboard, Course
// Catalogue, Completed Courses, Assessments, Resources, Announcement,
// Query, Policy & Procedures. "Completed Courses" and "Assessments" now
// each have their own dedicated route (`/app/courses/completed`,
// `/app/assessments` — CompletedCoursesPage.tsx / AssessmentsPage.tsx),
// so both are linked directly instead of the earlier in-page-tab-only /
// no-list-page states.
const NAV_ITEMS: SidebarNavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/courses", label: "Course Catalogue", icon: BookOpen },
  { to: "/app/courses/completed", label: "Completed Courses", icon: CheckCircle2 },
  { to: "/app/assessments", label: "Assessments", icon: ClipboardList },
  { to: "/app/resources", label: "Resources", icon: FileText },
  { to: "/app/announcements", label: "Announcement", icon: Megaphone },
  { to: "/app/queries", label: "Query", icon: MessageSquare },
  { to: "/app/policies", label: "Policy & Procedures", icon: ScrollText },
];

/**
 * User/Trainer Portal shell (SYSTEM_PLAN.md §25): distinct layout/
 * navigation, shared component library. `PortalAnnouncementPopup` is
 * mounted here (not per-page) so it surfaces once per portal session,
 * regardless of which `/app/*` page the trainer lands on first (Phase
 * 5.3.6, "important announcements can appear as a popup on Trainer Portal
 * open").
 */
// The stat cards + "Continue Learning" panel two-column split (UserDashboardPage.tsx,
// `xl:grid-cols-[minmax(0,1fr)_22rem]`) already leaves little room in this exact window — see
// useSidebarState.ts's `collapseByDefaultQuery`.
const SIDEBAR_COLLAPSE_QUERY = "(min-width: 1280px) and (max-width: 1790px)";

export function UserPortalLayout() {
  const sidebar = useSidebarState({ collapseByDefaultQuery: SIDEBAR_COLLAPSE_QUERY });
  const { platformName } = useBranding();

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar
        brand="Training Platform"
        items={NAV_ITEMS}
        isOpen={sidebar.isOpen}
        collapsed={sidebar.collapsed}
        onClose={sidebar.close}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={sidebar.toggle} />
        <main className="portal-main flex-1 p-4 sm:p-6 lg:px-8">
          <PageBreadcrumb items={NAV_ITEMS} />
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {platformName ?? "PCTR Training"}. All Rights Reserved.
        </footer>
      </div>
      <PortalAnnouncementPopup />
    </div>
  );
}
