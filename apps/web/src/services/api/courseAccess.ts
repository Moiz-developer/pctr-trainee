import {
  apiSuccessSchema,
  courseAccessListResponseSchema,
  courseAccessResponseSchema,
  type CourseAccessResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const accessEnvelope = apiSuccessSchema(courseAccessResponseSchema);

export async function listCourseAccess(courseId: string): Promise<CourseAccessResponse[]> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/access?pageSize=100`);
  return courseAccessListResponseSchema.parse(body).data;
}

/** Grants access — also reactivates a previously-revoked grant (see Unit 2.5). */
export async function grantCourseAccess(
  courseId: string,
  userId: string,
): Promise<CourseAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/access`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return accessEnvelope.parse(body).data;
}

export async function revokeCourseAccess(
  courseId: string,
  userId: string,
): Promise<CourseAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/access/${userId}`, {
    method: "DELETE",
  });
  return accessEnvelope.parse(body).data;
}

/**
 * Training Access assignment inside User Management unit: the user-centric
 * mirror of the three functions above, reached from AdminUsersPage.tsx
 * instead of a specific course's admin page — same `course_access` table,
 * same underlying grant/revoke behavior, just addressed by user id first.
 */
export async function listUserCourseAccess(userId: string): Promise<CourseAccessResponse[]> {
  const body = await apiFetch<unknown>(`/admin/users/${userId}/course-access?pageSize=100`);
  return courseAccessListResponseSchema.parse(body).data;
}

/** Grants access — also reactivates a previously-revoked grant (see grantCourseAccess above). */
export async function grantUserCourseAccess(
  userId: string,
  courseId: string,
): Promise<CourseAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/users/${userId}/course-access`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId }),
  });
  return accessEnvelope.parse(body).data;
}

export async function revokeUserCourseAccess(
  userId: string,
  courseId: string,
): Promise<CourseAccessResponse> {
  const body = await apiFetch<unknown>(`/admin/users/${userId}/course-access/${courseId}`, {
    method: "DELETE",
  });
  return accessEnvelope.parse(body).data;
}
