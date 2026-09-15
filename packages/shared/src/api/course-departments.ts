import { z } from "zod";
import { idSchema } from "../types/common.js";
import { apiSuccessSchema } from "./common.js";
import { departmentResponseSchema } from "./departments.js";

/**
 * Course <-> Department assignment (new — Admin Course & Training Content
 * Management unit). `course_departments` (SYSTEM_PLAN.md §14.2) has existed
 * since Unit 2.1 and is read by the access resolver (Unit 2.6/2.7), but no
 * unit ever gave it an admin API — this unit's "assign the course to
 * departments" requirement needs one.
 *
 * Modeled as a whole-set replace (`PUT`) rather than incremental grant/
 * revoke: unlike `course_access`, `course_departments` is a plain
 * many-to-many join with no soft-state/history fields (§14.2 lists only
 * `course_id`/`department_id`), and the natural admin interaction is a
 * multi-select "which departments is this course visible to" submitted at
 * once — so there is no revocation history to preserve here the way there
 * is for `course_access`. Permission `department.manage`: the plan's only
 * department-related permission, already used for the analogous
 * user<->department assignment (Phase 1) — keeping every department-join
 * mutation under one permission regardless of which entity is on the other
 * side, not a new code.
 */
export const setCourseDepartmentsRequestSchema = z.object({
  department_ids: z.array(idSchema),
});
export type SetCourseDepartmentsRequest = z.infer<typeof setCourseDepartmentsRequestSchema>;

/**
 * GET/PUT /api/v1/admin/courses/:courseId/departments: the full, current
 * set of departments a course is assigned to. Not paginated — like
 * `AdminUserResponse.department_ids`, this is a membership set, not a
 * browse list, and is bounded by how many departments exist. Full
 * `DepartmentResponse` objects (not bare ids) so the UI can render names
 * without a second round trip.
 */
export const courseDepartmentsResponseSchema = apiSuccessSchema(z.array(departmentResponseSchema));
export type CourseDepartmentsResponse = z.infer<typeof courseDepartmentsResponseSchema>;
