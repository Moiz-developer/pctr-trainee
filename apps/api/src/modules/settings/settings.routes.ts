import { Router } from "express";
import { updateSystemSettingsRequestSchema } from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../authorization/authorization.middleware.js";
import { ValidationError } from "../../lib/errors.js";
import {
  getSystemSettings,
  getVideoCompletionThreshold,
  updateSystemSettings,
} from "./settings.service.js";

/**
 * Admin Portal / System Settings (SYSTEM_PLAN.md §14.9/§16). `adminSettingsRoutes`
 * (mounted at /admin/settings) is gated by the new `system.manage`
 * permission — the one permission this feature is gated by, matching every
 * other admin-managed-lookup-table module's single-permission-gate
 * convention. `settingsRoutes` (mounted at /settings) carries only the one
 * value trainees genuinely need client-side — VideoLessonPlayer.tsx's video
 * completion threshold — auth-only, no permission gate, mirroring
 * `GET /dashboard`'s own "self-only, no permission gate" shape.
 */
export const adminSettingsRoutes: Router = Router();
export const settingsRoutes: Router = Router();

adminSettingsRoutes.get(
  "/",
  requireAuth,
  requirePermission("system.manage"),
  async (_req, res, next) => {
    try {
      const result = await getSystemSettings();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminSettingsRoutes.patch(
  "/",
  requireAuth,
  requirePermission("system.manage"),
  async (req, res, next) => {
    try {
      const parsedBody = updateSystemSettingsRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError(parsedBody.error.flatten().fieldErrors);
      }

      const identity = req.identity;
      if (!identity) {
        throw new Error("Missing authenticated identity.");
      }

      const result = await updateSystemSettings(parsedBody.data, identity.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

settingsRoutes.get("/video-completion-threshold", requireAuth, async (_req, res, next) => {
  try {
    const video_completion_threshold = await getVideoCompletionThreshold();
    res.json({ data: { video_completion_threshold } });
  } catch (error) {
    next(error);
  }
});
