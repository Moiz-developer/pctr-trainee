import { Router } from "express";
import { healthResponseSchema, type HealthResponse } from "@internal-training/shared";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { usersRoutes } from "../modules/users/users.routes.js";
import { departmentsRoutes } from "../modules/departments/departments.routes.js";
import { courseCategoriesRoutes } from "../modules/course-categories/course-categories.routes.js";
import { coursesRoutes } from "../modules/courses/courses.routes.js";
import { userCoursesRoutes } from "../modules/courses/user-courses.routes.js";
import { mediaRoutes } from "../modules/media/media.routes.js";
import { mediaRateLimit } from "../middleware/rate-limit.js";
import { progressRoutes } from "../modules/progress/progress.routes.js";
import { trainingHourRequirementsRoutes } from "../modules/training-hours/training-hour-requirements.routes.js";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes.js";
import { assessmentAttemptsRoutes } from "../modules/assessments/assessment-attempts.routes.js";
import { queriesRoutes } from "../modules/queries/queries.routes.js";
import { adminQueriesRoutes } from "../modules/queries/admin-queries.routes.js";
import { queryCategoriesRoutes } from "../modules/queries/query-categories.routes.js";
import { resourcesRoutes } from "../modules/resources/resources.routes.js";
import { adminResourcesRoutes } from "../modules/resources/admin-resources.routes.js";
import { resourceCategoriesRoutes } from "../modules/resources/resource-categories.routes.js";
import { policiesRoutes } from "../modules/policies/policies.routes.js";
import { adminPoliciesRoutes } from "../modules/policies/admin-policies.routes.js";
import { adminAnnouncementsRoutes } from "../modules/announcements/admin-announcements.routes.js";
import { announcementsRoutes } from "../modules/announcements/announcements.routes.js";
import { permissionsRoutes, rolesRoutes } from "../modules/roles/roles.routes.js";
import { adminSettingsRoutes, settingsRoutes } from "../modules/settings/settings.routes.js";

export const routes: Router = Router();

// Namespace health check, distinct from the infrastructure-level GET /health in app.ts.
// Domain routes (users, departments, courses, ...) are mounted here in later steps.
routes.get("/health", (_req, res) => {
  const body: HealthResponse = healthResponseSchema.parse({ data: { status: "ok" } });
  res.json(body);
});

routes.use("/auth", authRoutes);
routes.use("/admin/users", usersRoutes);
routes.use("/admin/departments", departmentsRoutes);
routes.use("/admin/course-categories", courseCategoriesRoutes);
routes.use("/admin/courses", coursesRoutes);

// User-facing course catalogue/detail (SYSTEM_PLAN.md §26) — deliberately
// NOT under /admin: separate router/permission model from Admin course
// management (see apps/api/src/modules/courses/user-courses.routes.ts).
routes.use("/courses", userCoursesRoutes);

// Media upload / signed-URL access (SYSTEM_PLAN.md §16/§26). Flat under
// /media, not /admin — upload/confirm are permission-gated Admin ops;
// :id/access-url is a User capability (auth + effective course access).
routes.use("/media", mediaRateLimit, mediaRoutes);

// Lesson Progress (SYSTEM_PLAN.md §26 `PATCH /progress/lessons/:id`, §18) —
// self-only, no permission gate; see progress.routes.ts.
routes.use("/progress", progressRoutes);

// Phase 3: training_hour_requirements admin config (§14.3, permission training.manage).
routes.use("/admin/training-hour-requirements", trainingHourRequirementsRoutes);

// Phase 3: GET /dashboard (§26/§40) — self-only, no permission gate.
routes.use("/dashboard", dashboardRoutes);

// Phase 4: trainee-facing Assessment Engine (§14.4/§19/§26) — flat under
// /assessments (not nested under /courses, matching §26's literally-named
// endpoint paths); admin CRUD lives nested under /admin/courses/:id/assessments
// instead (see courses.routes.ts).
routes.use("/assessments", assessmentAttemptsRoutes);

// Phase 6: user-facing Query/Support — create + list own tickets only
// (§14.7/§22/§26 "self").
routes.use("/queries", queriesRoutes);

// Phase 6.6: read-only Admin Query Queue (§14.7/§22/§26, permission
// query.manage) — every ticket, filterable by status/priority/category.
routes.use("/admin/queries", adminQueriesRoutes);

// Query Category dropdown unit: admin-managed Query Category CRUD
// (permission query.manage), mirroring /admin/resource-categories exactly.
routes.use("/admin/query-categories", queryCategoriesRoutes);

// Phase 5.1: user-facing Resource Library — list/view PUBLISHED,
// department-visible resources only (§14.5/§20/§26 "self").
routes.use("/resources", resourcesRoutes);

// Phase 5.1: Admin Resource Library management (§14.5/§20/§26, permission
// resource.manage) — CRUD + department targeting (nested
// /admin/resources/:resourceId/departments, permission department.manage).
routes.use("/admin/resources", adminResourcesRoutes);

// Phase 5.1: Admin resource category management (§14.5/§20, permission
// resource.manage) — mirrors /admin/course-categories exactly.
routes.use("/admin/resource-categories", resourceCategoriesRoutes);

// Phase 5.2: user-facing Policy & Procedures — list/view the currently
// active version of available policies only (§14.8/§23/§26 "general
// access").
routes.use("/policies", policiesRoutes);

// Phase 5.2: Admin Policy & Procedures management (§14.8/§23/§26) — CRUD +
// version management, permission `policy.manage`; activation is the
// separate, pre-existing permission `policy.version.activate`.
routes.use("/admin/policies", adminPoliciesRoutes);

// Phase 5.3.2: Admin Announcement API (§14.6/§21/§26). CRUD + department
// targeting (nested /admin/announcements/:announcementId/departments,
// permission department.manage), permission `announcement.manage`;
// publishing is the separate, pre-existing permission
// `announcement.publish`.
routes.use("/admin/announcements", adminAnnouncementsRoutes);

// Phase 5.3.3: user-facing Announcements — list/view PUBLISHED,
// department-visible announcements only, plus read/ack/dismiss tracking
// (§14.6/§21/§26 "self"). No frontend yet.
routes.use("/announcements", announcementsRoutes);

// Admin Role & Permission Management (§5/§10, permission `role.manage`) —
// CRUD over the existing roles/permissions/role_permissions tables; no new
// authorization architecture. `/admin/permissions` is the read-only
// permission catalogue backing the role-permission-assignment checkbox UI.
routes.use("/admin/roles", rolesRoutes);
routes.use("/admin/permissions", permissionsRoutes);

// Admin Portal / System Settings (§14.9/§16, permission `system.manage`) —
// replaces the previously-hardcoded media MIME/size/TTL constants and the
// video completion threshold with an admin-editable single-row table.
// `/settings` (no /admin prefix) carries only the one trainee-needed value.
routes.use("/admin/settings", adminSettingsRoutes);
routes.use("/settings", settingsRoutes);
