import { lazy, Suspense } from "react";
import { PageLoader } from "../components/ui/PageLoader";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { queryClient } from "./queryClient";
import { RootRedirect } from "./RootRedirect";
import { AuthProvider } from "../auth/AuthProvider";
import { RequireSession } from "../auth/RequireSession";
import { RequireAdminAccess } from "../authorization/RequireAdminAccess";
import { ToastProvider } from "../components/ui/Toast";
import { BrandingProvider } from "../components/shared/BrandingProvider";
import { GlobalProgressBar } from "../components/ui/GlobalProgressBar";
import { AuthLayout } from "../layouts/AuthLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { UserPortalLayout } from "../layouts/UserPortalLayout";
import { LoginPage } from "../pages/auth/LoginPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const AdminDashboardPage = lazy(() =>
  import("../pages/admin/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("../pages/admin/users/AdminUsersPage").then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const AdminRolesPage = lazy(() =>
  import("../pages/admin/roles/AdminRolesPage").then((module) => ({
    default: module.AdminRolesPage,
  })),
);
const AdminSettingsOverview = lazy(() =>
  import("../pages/admin/settings/AdminSettingsOverview").then((module) => ({
    default: module.AdminSettingsOverview,
  })),
);
const AdminDepartmentsPage = lazy(() =>
  import("../pages/admin/departments/AdminDepartmentsPage").then((module) => ({
    default: module.AdminDepartmentsPage,
  })),
);
const AdminCoursesListPage = lazy(() =>
  import("../pages/admin/courses/AdminCoursesListPage").then((module) => ({
    default: module.AdminCoursesListPage,
  })),
);
const AdminCourseDetailPage = lazy(() =>
  import("../pages/admin/courses/AdminCourseDetailPage").then((module) => ({
    default: module.AdminCourseDetailPage,
  })),
);
const CourseCategoriesPage = lazy(() =>
  import("../pages/admin/course-categories/CourseCategoriesPage").then((module) => ({
    default: module.CourseCategoriesPage,
  })),
);
const AdminTrainingHourRequirementsPage = lazy(() =>
  import("../pages/admin/training-hours/AdminTrainingHourRequirementsPage").then((module) => ({
    default: module.AdminTrainingHourRequirementsPage,
  })),
);
const AdminQueriesPage = lazy(() =>
  import("../pages/admin/queries/AdminQueriesPage").then((module) => ({
    default: module.AdminQueriesPage,
  })),
);
const AdminQueryDetailPage = lazy(() =>
  import("../pages/admin/queries/AdminQueryDetailPage").then((module) => ({
    default: module.AdminQueryDetailPage,
  })),
);
const AdminQueryCategoriesPage = lazy(() =>
  import("../pages/admin/queries/AdminQueryCategoriesPage").then((module) => ({
    default: module.AdminQueryCategoriesPage,
  })),
);
const AdminResourcesPage = lazy(() =>
  import("../pages/admin/resources/AdminResourcesPage").then((module) => ({
    default: module.AdminResourcesPage,
  })),
);
const AdminResourceCategoriesPage = lazy(() =>
  import("../pages/admin/resources/AdminResourceCategoriesPage").then((module) => ({
    default: module.AdminResourceCategoriesPage,
  })),
);
const AdminPoliciesPage = lazy(() =>
  import("../pages/admin/policies/AdminPoliciesPage").then((module) => ({
    default: module.AdminPoliciesPage,
  })),
);
const AdminPolicyDetailPage = lazy(() =>
  import("../pages/admin/policies/AdminPolicyDetailPage").then((module) => ({
    default: module.AdminPolicyDetailPage,
  })),
);
const AdminAnnouncementsPage = lazy(() =>
  import("../pages/admin/announcements/AdminAnnouncementsPage").then((module) => ({
    default: module.AdminAnnouncementsPage,
  })),
);
const UserDashboardPage = lazy(() =>
  import("../pages/portal/UserDashboardPage").then((module) => ({
    default: module.UserDashboardPage,
  })),
);
const CourseCataloguePage = lazy(() =>
  import("../pages/portal/courses/CourseCataloguePage").then((module) => ({
    default: module.CourseCataloguePage,
  })),
);
const CompletedCoursesPage = lazy(() =>
  import("../pages/portal/courses/CompletedCoursesPage").then((module) => ({
    default: module.CompletedCoursesPage,
  })),
);
const CourseDetailPage = lazy(() =>
  import("../pages/portal/courses/CourseDetailPage").then((module) => ({
    default: module.CourseDetailPage,
  })),
);
const AssessmentsPage = lazy(() =>
  import("../pages/portal/assessments/AssessmentsPage").then((module) => ({
    default: module.AssessmentsPage,
  })),
);
const TakeAssessmentPage = lazy(() =>
  import("../pages/portal/assessments/TakeAssessmentPage").then((module) => ({
    default: module.TakeAssessmentPage,
  })),
);
const MyQueriesPage = lazy(() =>
  import("../pages/portal/queries/MyQueriesPage").then((module) => ({
    default: module.MyQueriesPage,
  })),
);
const QueryDetailPage = lazy(() =>
  import("../pages/portal/queries/QueryDetailPage").then((module) => ({
    default: module.QueryDetailPage,
  })),
);
const ResourcesPage = lazy(() =>
  import("../pages/portal/resources/ResourcesPage").then((module) => ({
    default: module.ResourcesPage,
  })),
);
const PoliciesPage = lazy(() =>
  import("../pages/portal/policies/PoliciesPage").then((module) => ({
    default: module.PoliciesPage,
  })),
);
const AnnouncementsPage = lazy(() =>
  import("../pages/portal/announcements/AnnouncementsPage").then((module) => ({
    default: module.AnnouncementsPage,
  })),
);

/**
 * Root application shell (SYSTEM_PLAN.md §27 app/): providers + router
 * setup. Route tree per §24/§25 — `/admin/*` (session + admin-tier
 * permission) and `/app/*` (session only), both client-side UX guards only;
 * the API remains the authoritative enforcement layer (§10).
 *
 * `ToastProvider`/`GlobalProgressBar` (request-feedback unit) are mounted
 * once here, inside `QueryClientProvider` (the progress bar reads
 * TanStack Query's own `useIsMutating()`) and outside the router, so every
 * page/route shares the same toast stack and progress indicator with no
 * per-route wiring.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <ToastProvider>
          <GlobalProgressBar />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader fullScreen />}>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <AuthLayout>
                        <LoginPage />
                      </AuthLayout>
                    }
                  />

                  <Route
                    path="/forgot-password"
                    element={
                      <AuthLayout>
                        <ForgotPasswordPage />
                      </AuthLayout>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <AuthLayout>
                        <ResetPasswordPage />
                      </AuthLayout>
                    }
                  />

                  <Route element={<RequireSession />}>
                    <Route path="/" element={<RootRedirect />} />

                    <Route element={<RequireAdminAccess />}>
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboardPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="roles" element={<AdminRolesPage />} />
                        <Route path="departments" element={<AdminDepartmentsPage />} />
                        <Route path="courses" element={<AdminCoursesListPage />} />
                        <Route path="courses/:id" element={<AdminCourseDetailPage />} />
                        <Route path="course-categories" element={<CourseCategoriesPage />} />
                        <Route
                          path="training-hour-requirements"
                          element={<AdminTrainingHourRequirementsPage />}
                        />
                        <Route path="queries" element={<AdminQueriesPage />} />
                        <Route path="queries/categories" element={<AdminQueryCategoriesPage />} />
                        <Route path="queries/:id" element={<AdminQueryDetailPage />} />
                        <Route path="resources" element={<AdminResourcesPage />} />
                        <Route
                          path="resources/categories"
                          element={<AdminResourceCategoriesPage />}
                        />
                        <Route path="policies" element={<AdminPoliciesPage />} />
                        <Route path="policies/:id" element={<AdminPolicyDetailPage />} />
                        <Route path="announcements" element={<AdminAnnouncementsPage />} />
                        <Route path="settings" element={<AdminSettingsOverview />} />
                      </Route>
                    </Route>

                    <Route path="/app" element={<UserPortalLayout />}>
                      <Route index element={<UserDashboardPage />} />
                      <Route path="courses" element={<CourseCataloguePage />} />
                      <Route path="courses/completed" element={<CompletedCoursesPage />} />
                      <Route path="courses/:id" element={<CourseDetailPage />} />
                      <Route path="assessments" element={<AssessmentsPage />} />
                      <Route path="assessments/:id" element={<TakeAssessmentPage />} />
                      <Route path="queries" element={<MyQueriesPage />} />
                      <Route path="queries/:id" element={<QueryDetailPage />} />
                      <Route path="resources" element={<ResourcesPage />} />
                      <Route path="policies" element={<PoliciesPage />} />
                      <Route path="announcements" element={<AnnouncementsPage />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
