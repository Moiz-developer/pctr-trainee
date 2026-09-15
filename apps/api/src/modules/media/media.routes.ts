import { Router } from "express";
import { z } from "zod";
import {
  createMediaUploadUrlRequestSchema,
  confirmMediaUploadRequestSchema,
  type MediaPurpose,
} from "@internal-training/shared";
import { requireAuth } from "../auth/auth.middleware.js";
import { ForbiddenError, ValidationError } from "../../lib/errors.js";
import type { RequestIdentity } from "../auth/auth.types.js";
import { confirmMediaUpload, createMediaUploadUrl, getMediaAccessUrl } from "./media.service.js";

export const mediaRoutes: Router = Router();

// Strict UUID for the access-url resource id — this unit's spec requires a
// 422 on a malformed reference (same precedent as course-access, Unit 2.5).
const accessUrlParamsSchema = z.object({ id: z.uuid() });

/**
 * SYSTEM_PLAN.md §16/§26: "API validates the caller has permission for that
 * purpose" — upload permission is purpose-specific, not a single fixed
 * permission code. `course-media` stays an Admin-only operation
 * (`course.content.manage`, unchanged since Unit 2.8); `query-attachments`
 * (Phase 6.2) is a self capability — any authenticated ACTIVE user may
 * upload their own ticket attachment, the same self-only shape already
 * established by `POST /queries` (no permission code, just `requireAuth`).
 * `resource-files` (Phase 5.1), `policy-documents` (Phase 5.2), and
 * `announcement-media` (Phase 5.3.2) are all Admin-only operations like
 * course-media — resources, policy documents, and announcement media are
 * all admin-authored content, never a trainee upload — gated by
 * `resource.manage`/`policy.manage`/`announcement.manage` respectively, the
 * one general-management permission each feature is otherwise gated by
 * (policy VERSION ACTIVATION and announcement PUBLISHING are each a
 * separate permission, `policy.version.activate`/`announcement.publish`,
 * but uploading media is a create/manage action, not an activation/publish
 * one). This can't be a static `requirePermission(code)` middleware (Unit
 * 2.8's original shape) because the required permission now depends on the
 * request body's `purpose` field, which isn't known until after body
 * parsing — so the check moves inline, immediately after validating the
 * body.
 */
function assertCanUploadForPurpose(identity: RequestIdentity, purpose: MediaPurpose): void {
  if (purpose === "course-media" && !identity.permissions.includes("course.content.manage")) {
    throw new ForbiddenError();
  }
  if (purpose === "resource-files" && !identity.permissions.includes("resource.manage")) {
    throw new ForbiddenError();
  }
  if (purpose === "policy-documents" && !identity.permissions.includes("policy.manage")) {
    throw new ForbiddenError();
  }
  if (purpose === "announcement-media" && !identity.permissions.includes("announcement.manage")) {
    throw new ForbiddenError();
  }
}

mediaRoutes.post("/upload-url", requireAuth, async (req, res, next) => {
  try {
    const parsed = createMediaUploadUrlRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first).
      throw new Error("Missing authenticated identity.");
    }
    assertCanUploadForPurpose(identity, parsed.data.purpose);
    const result = await createMediaUploadUrl(parsed.data);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

mediaRoutes.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const parsed = confirmMediaUploadRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      // Unreachable in practice (requireAuth runs first).
      throw new Error("Missing authenticated identity.");
    }
    assertCanUploadForPurpose(identity, parsed.data.purpose);
    const result = await confirmMediaUpload(parsed.data, identity.id);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

mediaRoutes.get("/:id/access-url", requireAuth, async (req, res, next) => {
  try {
    const parsed = accessUrlParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const identity = req.identity;
    if (!identity) {
      throw new Error("Missing authenticated identity.");
    }
    const result = await getMediaAccessUrl(identity.id, parsed.data.id, identity.permissions);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
