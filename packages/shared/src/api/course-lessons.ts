import { z } from "zod";
import { httpsUrlSchema, idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

export const lessonContentTypeSchema = z.enum([
  "VIDEO",
  "PDF",
  "DOCUMENT",
  "PRESENTATION",
  "EXTERNAL_LINK",
  "TEXT",
]);
export type LessonContentType = z.infer<typeof lessonContentTypeSchema>;

export const lessonClassificationSchema = z.enum(["THEORETICAL", "PRACTICAL"]);
export type LessonClassification = z.infer<typeof lessonClassificationSchema>;

/**
 * SYSTEM_PLAN.md §14.2's content-type/field rules, expressed once and
 * reused both at request-validation time (create, via Zod's
 * `superRefine`) and at update time (in the API service layer, after
 * merging the request against the existing stored row — a partial update
 * can't be validated by the request shape alone, since it may omit
 * `content_type` and rely on the lesson's current value). Keeping this as
 * one exported function avoids the two call sites drifting apart.
 */
export interface LessonContentFieldIssue {
  path: "external_url" | "text_content";
  message: string;
}

export function checkLessonContentFields(
  contentType: LessonContentType,
  externalUrl: string | null | undefined,
  textContent: string | null | undefined,
): LessonContentFieldIssue[] {
  const issues: LessonContentFieldIssue[] = [];
  const hasExternalUrl = externalUrl !== undefined && externalUrl !== null;
  const hasTextContent = textContent !== undefined && textContent !== null;

  if (contentType === "EXTERNAL_LINK") {
    if (!hasExternalUrl) {
      issues.push({
        path: "external_url",
        message: "external_url is required when content_type is EXTERNAL_LINK.",
      });
    }
    if (hasTextContent) {
      issues.push({
        path: "text_content",
        message: "text_content must not be supplied when content_type is EXTERNAL_LINK.",
      });
    }
  } else if (contentType === "TEXT") {
    if (!hasTextContent) {
      issues.push({
        path: "text_content",
        message: "text_content is required when content_type is TEXT.",
      });
    }
    if (hasExternalUrl) {
      issues.push({
        path: "external_url",
        message: "external_url must not be supplied when content_type is TEXT.",
      });
    }
  } else {
    // VIDEO, PDF, DOCUMENT, PRESENTATION
    if (hasExternalUrl) {
      issues.push({
        path: "external_url",
        message: `external_url must not be supplied when content_type is ${contentType}.`,
      });
    }
    if (hasTextContent) {
      issues.push({
        path: "text_content",
        message: `text_content must not be supplied when content_type is ${contentType}.`,
      });
    }
  }
  return issues;
}

/**
 * POST /api/v1/admin/courses/:courseId/modules/:moduleId/lessons
 * (SYSTEM_PLAN.md §14.2, permission `course.create` — same reasoning as
 * Units 2.2/2.3's permission mapping). `sort_order`/`classification` are
 * required (no defaults in the schema). `is_required` may be set on create
 * (a content-configuration field, unlike `is_active` which is a lifecycle/
 * retirement flag never accepted on create — matching the Course/Module
 * create convention). `media_asset_id` is deliberately excluded — no
 * media/upload endpoint exists yet, so there is no legitimate id for a
 * client to send (same reasoning as `Course.thumbnail_media_id` in Unit
 * 2.2); it still appears in the response, always `null` for now.
 * `module_id`/`id`/timestamps are never client input — `module_id` comes
 * from the URL.
 */
export const createCourseLessonRequestSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).nullable().optional(),
    content_type: lessonContentTypeSchema,
    external_url: httpsUrlSchema.nullable().optional(),
    text_content: z.string().min(1).nullable().optional(),
    duration_seconds: z.number().int().nonnegative().nullable().optional(),
    sort_order: z.number().int(),
    is_required: z.boolean().optional(),
    classification: lessonClassificationSchema,
  })
  .superRefine((data, ctx) => {
    for (const issue of checkLessonContentFields(
      data.content_type,
      data.external_url,
      data.text_content,
    )) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });
export type CreateCourseLessonRequest = z.infer<typeof createCourseLessonRequestSchema>;

/**
 * PATCH .../lessons/:id. Partial update; content-type/field consistency is
 * validated in the API service layer against the merged (existing +
 * supplied) state, using `checkLessonContentFields` above — not here,
 * since a partial payload alone doesn't carry enough information (see this
 * unit's implementation report). `is_active` is the retirement mechanism
 * (§17) — no delete endpoint exists.
 */
export const updateCourseLessonRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  content_type: lessonContentTypeSchema.optional(),
  external_url: httpsUrlSchema.nullable().optional(),
  text_content: z.string().min(1).nullable().optional(),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_required: z.boolean().optional(),
  classification: lessonClassificationSchema.optional(),
  is_active: z.boolean().optional(),
});
export type UpdateCourseLessonRequest = z.infer<typeof updateCourseLessonRequestSchema>;

/** Response shape for all course-lesson endpoints — mirrors §14.2's columns. */
export const courseLessonResponseSchema = z.object({
  id: idSchema,
  module_id: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  content_type: lessonContentTypeSchema,
  media_asset_id: idSchema.nullable(),
  external_url: z.string().nullable(),
  text_content: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  sort_order: z.number().int(),
  is_required: z.boolean(),
  classification: lessonClassificationSchema,
  is_active: z.boolean(),
  created_at: isoDateStringSchema,
  updated_at: isoDateStringSchema,
});
export type CourseLessonResponse = z.infer<typeof courseLessonResponseSchema>;

/** GET .../lessons: { data, meta } (SYSTEM_PLAN.md §26). */
export const courseLessonListResponseSchema = apiPaginatedSchema(courseLessonResponseSchema);
export type CourseLessonListResponse = z.infer<typeof courseLessonListResponseSchema>;

/**
 * GET .../lessons query params. No filters requested for this unit (this is
 * an admin content-management view — both active and inactive lessons are
 * always listed). Page-size defaults mirror the already-established
 * convention.
 */
export const listCourseLessonsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListCourseLessonsQuery = z.infer<typeof listCourseLessonsQuerySchema>;
