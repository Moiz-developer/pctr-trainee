import {
  videoCompletionThresholdDetailResponseSchema,
  type VideoCompletionThresholdResponse,
} from "@internal-training/shared";
import { apiFetch } from "./client";

/** GET /api/v1/settings/video-completion-threshold — trainee-facing, auth-only. */
export async function getVideoCompletionThreshold(): Promise<VideoCompletionThresholdResponse> {
  const body = await apiFetch<unknown>("/settings/video-completion-threshold");
  return videoCompletionThresholdDetailResponseSchema.parse(body).data;
}
