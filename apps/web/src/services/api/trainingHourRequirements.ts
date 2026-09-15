import {
  trainingHourRequirementListResponseSchema,
  trainingHourRequirementResponseSchema,
  type CreateTrainingHourRequirementRequest,
  type TrainingHourRequirementListResponse,
  type TrainingHourRequirement,
} from "@internal-training/shared";
import { apiFetch } from "./client";

/** GET /api/v1/admin/training-hour-requirements (permission training.manage). */
export async function listTrainingHourRequirements(
  params: { page?: number; pageSize?: number } = {},
): Promise<TrainingHourRequirementListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize ?? 50));
  const body = await apiFetch<unknown>(`/admin/training-hour-requirements?${qs.toString()}`);
  return trainingHourRequirementListResponseSchema.parse(body);
}

export async function createTrainingHourRequirement(
  input: CreateTrainingHourRequirementRequest,
): Promise<TrainingHourRequirement> {
  const body = await apiFetch<unknown>("/admin/training-hour-requirements", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return trainingHourRequirementResponseSchema.parse(body).data;
}
