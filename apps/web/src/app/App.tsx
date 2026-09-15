import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { queryClient } from "./queryClient";
import { RootRedirect } from "./RootRedirect";
import { AuthProvider } from "../auth/AuthProvider";
import { RequireSession } from "../auth/RequireSession";
import { RequireAdminAccess } from "../authorization/RequireAdminAccess";
import { AuthLayout } from "../layouts/AuthLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { UserPortalLayout } from "../layouts/UserPortalLayout";
import { LoginPage } from "../pages/auth/LoginPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "../pages/admin/users/AdminUsersPage";
import { AdminRolesPage } from "../pages/admin/roles/AdminRolesPage";
import { AdminSettingsPage } from "../pages/admin/settings/AdminSettingsPage";
import { AdminDepartmentsPage } from "../pages/admin/departments/AdminDepartmentsPage";
import { AdminCoursesListPage } from "../pages/admin/courses/AdminCoursesListPage";
import { AdminCourseDetailPage } from "../pages/admin/courses/AdminCourseDetailPage";
import { CourseCategoriesPage } from "../pages/admin/course-categories/CourseCategoriesPage";
import { AdminTrainingHourRequirementsPage } from "../pages/admin/training-hours/AdminTrainingHourRequirementsPage";
import { AdminQueriesPage } from "../pages/admin/queries/AdminQueriesPage";
import { AdminQueryDetailPage } from "../pages/admin/queries/AdminQueryDetailPage";
import { AdminQueryCategoriesPage } from "../pages/admin/queries/AdminQueryCategoriesPage";
import { AdminResourcesPage } from "../pages/admin/resources/AdminResourcesPage";
import { AdminResourceCategoriesPage } from "../pages/admin/resources/AdminResourceCategoriesPage";
import { AdminPoliciesPage } from "../pages/admin/policies/AdminPoliciesPage";
import { AdminPolicyDetailPage } from "../pages/admin/policies/AdminPolicyDetailPage";
import { AdminAnnouncementsPage } from "../pages/admin/announcements/AdminAnnouncementsPage";
import { UserDashboardPage } from "../pages/portal/UserDashboardPage";
import { CourseCataloguePage } from "../pages/portal/courses/CourseCataloguePage";
import { CompletedCoursesPage } from "../pages/portal/courses/CompletedCoursesPage";
import { CourseDetailPage } from "../pages/portal/courses/CourseDetailPage";
import { AssessmentsPage } from "../pages/portal/assessments/AssessmentsPage";
import { TakeAssessmentPage } from "../pages/portal/assessments/TakeAssessmentPage";
import { MyQueriesPage } from "../pages/portal/queries/MyQueriesPage";
import { QueryDetailPage } from "../pages/portal/queries/QueryDetailPage";
import { ResourcesPage } from "../pages/portal/resources/ResourcesPage";
import { PoliciesPage } from "../pages/portal/policies/PoliciesPage";
import { AnnouncementsPage } from "../pages/portal/announcements/AnnouncementsPage";
import { NotFoundPage } from "../pages/NotFoundPage";

/**
 * Root application shell (SYSTEM_PLAN.md §27 app/): providers + router
 * setup. Route tree per §24/§25 — `/admin/*` (session + admin-tier
 * permission) and `/app/*` (session only), both client-side UX guards only;
 * the API remains the authoritative enforcement layer (§10).
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <AuthLayout>
                  <LoginPage />
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
                  <Route path="resources/categories" element={<AdminResourceCategoriesPage />} />
                  <Route path="policies" element={<AdminPoliciesPage />} />
                  <Route path="policies/:id" element={<AdminPolicyDetailPage />} />
                  <Route path="announcements" element={<AdminAnnouncementsPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
