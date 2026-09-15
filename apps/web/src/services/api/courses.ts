import {
  apiSuccessSchema,
  courseListResponseSchema,
  courseProgressSummaryResponseSchema,
  courseResponseSchema,
  type CourseListResponse,
  type CourseResponse,
  type CourseStatus,
  type CreateCourseRequest,
  type UpdateCourseRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const courseEnvelope = apiSuccessSchema(courseResponseSchema);

/** GET /api/v1/admin/courses/progress-summary (Admin Dashboard real data unit) — real in-progress count across every trainee. */
export async function getCourseProgressSummary(): Promise<{ in_progress_count: number }> {
  const body = await apiFetch<unknown>("/admin/courses/progress-summary");
  return courseProgressSummaryResponseSchema.parse(body).data;
}

export async function listCourses(
  params: { page?: number; pageSize?: number; status?: CourseStatus } = {},
): Promise<CourseListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  if (params.status) qs.set("status", params.status);
  const body = await apiFetch<unknown>(`/admin/courses?${qs.toString()}`);
  return courseListResponseSchema.parse(body);
}

export async function getCourse(id: string): Promise<CourseResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${id}`);
  return courseEnvelope.parse(body).data;
}

export async function createCourse(input: CreateCourseRequest): Promise<CourseResponse> {
  const body = await apiFetch<unknown>("/admin/courses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return courseEnvelope.parse(body).data;
}

export async function updateCourse(
  id: string,
  input: UpdateCourseRequest,
): Promise<CourseResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return courseEnvelope.parse(body).data;
}

export async function archiveCourse(id: string): Promise<CourseResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${id}/archive`, { method: "POST" });
  return courseEnvelope.parse(body).data;
}
