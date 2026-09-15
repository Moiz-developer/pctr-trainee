import { Router } from "express";
import { z } from "zod";
import {
  createAnnouncementRequestSchema,
  updateAnnouncementRequestSchema,
  listAdminAnnouncementsQuerySchema,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  archiveAnnouncement,
  createAnnouncement,
  getAdminAnnouncement,
  listAdminAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
} from "./admin-announcements.service.js";
import { announcementDepartmentsRoutes } from "./announcement-departments.routes.js";
import { announcementAccessRoutes } from "./announcement-access.routes.js";

/**
 * Admin Announcement API (SYSTEM_PLAN.md §14.6/§21/§26, Phase 5.3.2 —
 * admin only, no Trainee API/frontend yet). Two deliberately separate
 * permissions, per this phase's own instruction: `announcement.manage`
 * gates create/update/archive/department-targeting; the pre-existing
 * `announcement.publish` gates ONLY the publish action. Read routes
 * (list/detail) accept EITHER — a publish-only reviewer still needs to
 * browse what exists to decide what to publish — via `requirePermission`'s
 * array form (the same "any of these codes" generalization Phase 5.2 added
 * for Policies). `:announcementId/departments` mirrors
 * admin-resources.routes.ts's identical nested-sub-router mount.
 */
export const adminAnnouncementsRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

const READ_PERMISSIONS = ["announcement.manage", "announcement.publish"];

adminAnnouncementsRoutes.use("/:announcementId/departments", announcementDepartmentsRoutes);
adminAnnouncementsRoutes.use("/:announcementId/access", announcementAccessRoutes);

adminAnnouncementsRoutes.get(
  "/",
  requireAuth,
  requirePermission(READ_PERMISSIONS),
  async (req, res, next) => {
    try {
      const parsedQuery = listAdminAnnouncementsQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
      }
      const { items, meta } = await listAdminAnnouncements(parsedQuery.data);
      res.json({ data: items, meta });
    } catch (error) {
      next(error);
    }
  },
);

adminAnnouncementsRoutes.get(
  "/:id",
  requireAuth,
  requirePermission(READ_PERMISSIONS),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await getAdminAnnouncement(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminAnnouncementsRoutes.post(
  "/",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = createAnnouncementRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await createAnnouncement(identity.id, parsedBody.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminAnnouncementsRoutes.patch(
  "/:id",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const parsedBody = updateAnnouncementRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }
      const result = await updateAnnouncement(parsedParams.data.id, parsedBody.data);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminAnnouncementsRoutes.post(
  "/:id/publish",
  requireAuth,
  requirePermission("announcement.publish"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await publishAnnouncement(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminAnnouncementsRoutes.post(
  "/:id/archive",
  requireAuth,
  requirePermission("announcement.manage"),
  async (req, res, next) => {
    try {
      const parsedParams = idParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new ValidationError(parsedParams.error.flatten().fieldErrors);
      }
      const result = await archiveAnnouncement(parsedParams.data.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);
