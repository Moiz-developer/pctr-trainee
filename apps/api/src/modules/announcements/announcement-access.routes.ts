import { Router } from "express";
import { z } from "zod";
import {
  grantAnnouncementAccessRequestSchema,
  listAnnouncementAccessQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  grantAnnouncementAccess,
  listAnnouncementAccess,
  revokeAnnouncementAccess,
} from "./announcement-access.service.js";

// mergeParams: true — mounted at /:announcementId/access under admin-announcements.routes.ts.
export const announcementAccessRoutes: Router = Router({ mergeParams: true });

const announcementParamsSchema = z.object({ announcementId: z.string().min(1) });
const revokeParamsSchema = z.object({
  announcementId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Consistent granular access control unit: explicit per-user Announcement
 * access grants, mirroring resource-access.routes.ts/course-access.routes.ts
 * exactly. Permission `announcement.manage` — the same permission already
 * gating create/update/archive/department-targeting for this feature (no
 * new permission created).
 */

announcementAccessRoutes.post(
  "/",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = announcementParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = grantAnnouncementAccessRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const { response, status } = await grantAnnouncementAccess(
        parsedParams.data.announcementId,
        parsedBody.data,
        identity.id,
      );
      res.status(status).json({ data: response });
    } catch (error) {
      next(error);
    }
  },
);

announcementAccessRoutes.get(
  "/",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = announcementParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedQuery = listAnnouncementAccessQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAnnouncementAccess(
        parsedParams.data.announcementId,
        parsedQuery.data,
      );
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

announcementAccessRoutes.delete(
  "/:userId",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = revokeParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await revokeAnnouncementAccess(
        parsedParams.data.announcementId,
        parsedParams.data.userId,
        identity.id,
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
