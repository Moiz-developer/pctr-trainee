import {
  apiSuccessSchema,
  courseModuleListResponseSchema,
  courseModuleResponseSchema,
  type CourseModuleResponse,
  type CreateCourseModuleRequest,
  type UpdateCourseModuleRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

const moduleEnvelope = apiSuccessSchema(courseModuleResponseSchema);

export async function listCourseModules(courseId: string): Promise<CourseModuleResponse[]> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/modules?pageSize=100`);
  return courseModuleListResponseSchema.parse(body).data;
}

export async function createCourseModule(
  courseId: string,
  input: CreateCourseModuleRequest,
): Promise<CourseModuleResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/modules`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return moduleEnvelope.parse(body).data;
}

export async function updateCourseModule(
  courseId: string,
  moduleId: string,
  input: UpdateCourseModuleRequest,
): Promise<CourseModuleResponse> {
  const body = await apiFetch<unknown>(`/admin/courses/${courseId}/modules/${moduleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return moduleEnvelope.parse(body).data;
}
