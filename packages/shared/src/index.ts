// Public entry point of @internal-training/shared.
// This package holds only pure types, constants, and Zod contract schemas —
// no business logic, no authorization logic, no database/framework code
// (see SYSTEM_PLAN.md §29/§30 and this step's architectural boundary).

export * from "./types/common.js";
export * from "./api/common.js";
export * from "./api/health.js";
export * from "./api/admin-users.js";
export * from "./api/departments.js";
export * from "./api/auth.js";
export * from "./api/courses.js";
export * from "./api/course-modules.js";
export * from "./api/course-lessons.js";
export * from "./api/course-access.js";
export * from "./api/course-catalogue.js";
export * from "./api/media.js";
export * from "./api/course-departments.js";
export * from "./api/lesson-progress.js";
export * from "./api/course-categories.js";
export * from "./api/course-progress.js";
export * from "./api/training-hour-requirements.js";
export * from "./api/dashboard.js";
export * from "./api/assessments.js";
export * from "./api/assessment-attempts.js";
export * from "./api/assessment-grading.js";
export * from "./api/queries.js";
export * from "./api/resources.js";
export * from "./api/resource-access.js";
export * from "./api/policies.js";
export * from "./api/announcements.js";
export * from "./api/announcement-access.js";
export * from "./api/roles.js";
export * from "./api/system-settings.js";
