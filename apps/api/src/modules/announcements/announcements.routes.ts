import { Router } from "express";
import { z } from "zod";
import { listAnnouncementsQuerySchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  acknowledgeAnnouncement,
  dismissAnnouncement,
  getAnnouncementDetail,
  listAnnouncements,
} from "./announcements.service.js";

/**
 * Announcements — self-service half only (SYSTEM_PLAN.md §14.6/§21/§26:
 * `GET /announcements`, `POST /announcements/:id/ack`, "self").
 * `requireAuth` only, no permission middleware — visibility is resolved
 * entirely server-side by `effectiveAnnouncementVisibilityFilter`
 * (authorization/access.service.ts), mirroring resources.routes.ts/
 * user-courses.routes.ts exactly. The authenticated identity (`identity.id`)
 * is the only source of "which user" for every route here — never a
 * request body/param — so a caller can only ever read/ack/dismiss as
 * themselves.
 */
export const announcementsRoutes: Router = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

announcementsRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const parsedQuery = listAnnouncementsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new ValidationError(parsedQuery.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const { items, meta } = await listAnnouncements(identity.id, parsedQuery.data);
    res.json({ data: items, meta });
  } catch (error) {
    next(error);
  }
});

announcementsRoutes.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await getAnnouncementDetail(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

announcementsRoutes.post("/:id/ack", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await acknowledgeAnnouncement(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

announcementsRoutes.post("/:id/dismiss", requireAuth, async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.flatten().fieldErrors);
    }

    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }

    const result = await dismissAnnouncement(identity.id, parsedParams.data.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
