import { useState } from "react";
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
import { TopBar } from "../components/shared/TopBar";
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
export function UserPortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        brand="Training Platform"
        items={NAV_ITEMS}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <PortalAnnouncementPopup />
    </div>
  );
}
