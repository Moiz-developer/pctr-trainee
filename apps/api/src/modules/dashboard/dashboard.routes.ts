import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getDashboard } from "./dashboard.service.js";

/**
 * GET /api/v1/dashboard (SYSTEM_PLAN.md §26: "session | self"). `requireAuth`
 * only — no permission middleware, self-scoped entirely by the authenticated
 * identity, matching the same shape already established by GET /courses and
 * PATCH /progress/lessons/:id.
 */
export const dashboardRoutes: Router = Router();

dashboardRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await getDashboard(identity.id, identity.departmentIds);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
