import {
  apiSuccessSchema,
  courseCategoryListResponseSchema,
  courseCategoryResponseSchema,
  type CourseCategoryResponse,
  type CreateCourseCategoryRequest,
  type UpdateCourseCategoryRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const courseCategoryEnvelope = apiSuccessSchema(courseCategoryResponseSchema);

/** GET /api/v1/admin/course-categories?pageSize=100 — full list for the admin management page. */
export async function listCourseCategories(
  params: { is_active?: boolean } = {},
): Promise<CourseCategoryResponse[]> {
  const qs = new URLSearchParams();
  qs.set("pageSize", "100");
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const body = await apiFetch<unknown>(`/admin/course-categories?${qs.toString()}`);
  return courseCategoryListResponseSchema.parse(body).data;
}

/** Active-only categories, for the Course create/edit form's dropdown. */
export async function listActiveCourseCategories(): Promise<CourseCategoryResponse[]> {
  return listCourseCategories({ is_active: true });
}

export async function createCourseCategory(
  input: CreateCourseCategoryRequest,
): Promise<CourseCategoryResponse> {
  const body = await apiFetch<unknown>("/admin/course-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return courseCategoryEnvelope.parse(body).data;
}

export async function updateCourseCategory(
  id: string,
  input: UpdateCourseCategoryRequest,
): Promise<CourseCategoryResponse> {
  const body = await apiFetch<unknown>(`/admin/course-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return courseCategoryEnvelope.parse(body).data;
}
