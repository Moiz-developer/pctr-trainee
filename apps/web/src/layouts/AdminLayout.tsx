import { Outlet } from "react-router-dom";
import {
  BookOpen,
  Building2,
  Clock3,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { Sidebar, type SidebarNavItem } from "../components/shared/Sidebar";
import { useSidebarState } from "../components/shared/useSidebarState";
import { TopBar } from "../components/shared/TopBar";
import { PageBreadcrumb } from "../components/shared/PageBreadcrumb";
import { useBranding } from "../components/shared/useBranding";

// Only routes that actually exist — Assessments/Settings nav entries are
// added by the units that build those pages (SYSTEM_PLAN.md §4/§24 names
// them as eventual Admin Portal areas, but adding a nav link with no real
// page behind it is never done — see prior units' implementation reports).
// Courses was added by the Admin Course & Training Content Management
// unit; Training Categories by the Admin Navigation + Dynamic Course
// Categories unit; Users/Departments by this unit (Admin Users +
// Departments UI) — closing the Phase 1 gap the Phase 2J audit identified
// (full backend existed, zero admin UI). Training Hour Requirements added
// by Phase 3 (§14.3's admin-configured "hours allocated" side of the
// dashboard). Queries added by Phase 6.6 (the read-only admin ticket
// queue, permission `query.manage`). Resources added by Phase 5.1
// (permission `resource.manage`) — Resource Categories management is
// reached from within the Resources page itself, not a second nav entry.
// Policies added by Phase 5.2 (permission `policy.manage` or
// `policy.version.activate`) — version management is reached from within
// each policy's own detail page, not a second nav entry. Announcements
// added by Phase 5.3.5 (permission `announcement.manage` or
// `announcement.publish`). Roles & Permissions added by the Admin Role &
// Permission Management unit (permission `role.manage`) — replaces the
// Users page's own former role-source workaround with a real roles API.
// Settings added by the Admin Portal / System Settings unit (permission
// `system.manage`) — media MIME/size limits, signed-URL TTLs, and the
// video completion threshold, previously hardcoded constants.
const NAV_ITEMS: SidebarNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck },
  { to: "/admin/departments", label: "Departments", icon: Building2 },
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/course-categories", label: "Training Categories", icon: Tags },
  { to: "/admin/training-hour-requirements", label: "Training Hours", icon: Clock3 },
  { to: "/admin/queries", label: "Queries", icon: MessageSquare },
  { to: "/admin/resources", label: "Resources", icon: FileText },
  { to: "/admin/policies", label: "Policies", icon: ScrollText },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

/** Admin Portal shell (SYSTEM_PLAN.md §24): distinct layout/navigation, shared component library. */
export function AdminLayout() {
  const sidebar = useSidebarState();
  const { platformName } = useBranding();

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar
        brand="Admin Portal"
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
    </div>
  );
}
