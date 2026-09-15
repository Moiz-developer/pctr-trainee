import {
  apiSuccessSchema,
  courseCatalogueListResponseSchema,
  courseDetailSchema,
  type CourseCatalogueListResponse,
  type CourseDetail,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const courseDetailEnvelope = apiSuccessSchema(courseDetailSchema);

/**
 * User-facing course catalogue (SYSTEM_PLAN.md §26 `GET /courses` — Unit
 * 2.7, unmodified). Already filters to published + effectively-accessible
 * courses server-side; the client never filters or supplies access data.
 */
export async function listUserCourses(
  params: { page?: number; pageSize?: number } = {},
): Promise<CourseCatalogueListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 100));
  const body = await apiFetch<unknown>(`/courses?${qs.toString()}`);
  return courseCatalogueListResponseSchema.parse(body);
}

/** GET /api/v1/courses/:id (Unit 2.7, unmodified) — 403 if not published/accessible, 404 if it doesn't exist. */
export async function getUserCourseDetail(id: string): Promise<CourseDetail> {
  const body = await apiFetch<unknown>(`/courses/${id}`);
  return courseDetailEnvelope.parse(body).data;
}
