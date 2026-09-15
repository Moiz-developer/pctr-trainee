import { z } from "zod";
import { idSchema, isoDateStringSchema } from "../types/common.js";
import { apiPaginatedSchema } from "./common.js";

/**
 * Consistent granular access control unit: explicit per-user Announcement
 * access grants, mirroring packages/shared/src/api/resource-access.ts (and,
 * before it, course-access.ts) field-for-field. Permission
 * `announcement.manage` — the permission already gating create/update/
 * archive/department-targeting for this feature (no new permission
 * created).
 */
export const grantAnnouncementAccessRequestSchema = z.object({
  user_id: idSchema,
});
export type GrantAnnouncementAccessRequest = z.infer<typeof grantAnnouncementAccessRequestSchema>;

export const announcementAccessResponseSchema = z.object({
  id: idSchema,
  announcement_id: idSchema,
  user_id: idSchema,
  granted_by: idSchema.nullable(),
  granted_at: isoDateStringSchema,
  revoked_by: idSchema.nullable(),
  revoked_at: isoDateStringSchema.nullable(),
  is_active: z.boolean(),
});
export type AnnouncementAccessResponse = z.infer<typeof announcementAccessResponseSchema>;

export const announcementAccessListResponseSchema = apiPaginatedSchema(
  announcementAccessResponseSchema,
);
export type AnnouncementAccessListResponse = z.infer<typeof announcementAccessListResponseSchema>;

export const listAnnouncementAccessQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListAnnouncementAccessQuery = z.infer<typeof listAnnouncementAccessQuerySchema>;
