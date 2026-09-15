import {
  apiSuccessSchema,
  courseLessonListResponseSchema,
  courseLessonResponseSchema,
  type CourseLessonResponse,
  type CreateCourseLessonRequest,
  type UpdateCourseLessonRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const lessonEnvelope = apiSuccessSchema(courseLessonResponseSchema);

export async function listCourseLessons(
  courseId: string,
  moduleId: string,
): Promise<CourseLessonResponse[]> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons?pageSize=100`,
  );
  return courseLessonListResponseSchema.parse(body).data;
}

export async function createCourseLesson(
  courseId: string,
  moduleId: string,
  input: CreateCourseLessonRequest,
): Promise<CourseLessonResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/modules/${moduleId}/lessons`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return lessonEnvelope.parse(body).data;
}

export async function updateCourseLesson(
  courseId: string,
  moduleId: string,
  lessonId: string,
  input: UpdateCourseLessonRequest,
): Promise<CourseLessonResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return lessonEnvelope.parse(body).data;
}

export async function setCourseLessonMedia(
  courseId: string,
  moduleId: string,
  lessonId: string,
  mediaAssetId: string | null,
): Promise<CourseLessonResponse> {
  const body = await apiFetch<unknown>(
    `/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/media`,
    { method: "PUT", body: JSON.stringify({ media_asset_id: mediaAssetId }) },
  );
  return lessonEnvelope.parse(body).data;
}
