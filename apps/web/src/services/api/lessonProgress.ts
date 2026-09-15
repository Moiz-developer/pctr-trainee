import {
  lessonProgressDetailResponseSchema,
  type LessonProgressResponse,
  type UpdateLessonProgressRequest,
} from "@internal-training/shared";
import { apiFetch } from "./client";

/**
 * GET /api/v1/progress/lessons/:id (Unit 2D, unmodified). Self-only — the
 * authenticated caller's own progress; returns a synthetic NOT_STARTED
 * projection (not a 404/null) when no row exists yet, per the shared
 * schema's contract.
 */
export async function getLessonProgress(lessonId: string): Promise<LessonProgressResponse> {
  const body = await apiFetch<unknown>(`/progress/lessons/${lessonId}`);
  return lessonProgressDetailResponseSchema.parse(body).data;
}

/**
 * PATCH /api/v1/progress/lessons/:id (Unit 2D, unmodified) — one endpoint
 * for the whole lifecycle: an empty body starts the lesson, `status:
 * "COMPLETED"` completes it, `video_position_seconds` updates resume
 * position. Always returns the resulting persisted row, which callers use
 * to update their query cache directly (the API response is the source of
 * truth, never a locally-computed value).
 */
export async function updateLessonProgress(
  lessonId: string,
  input: UpdateLessonProgressRequest = {},
): Promise<LessonProgressResponse> {
  const body = await apiFetch<unknown>(`/progress/lessons/${lessonId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return lessonProgressDetailResponseSchema.parse(body).data;
}
