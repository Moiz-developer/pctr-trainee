import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

/**
 * Minimal fixed-window, in-memory rate limiter (no dependency). The project
 * had no rate limiting; this covers the endpoints that mint signed Storage
 * URLs or serve unauthenticated data (`/media/*`, `/settings/branding`).
 *
 * Limits: counters live in this process only, so on a multi-instance/
 * serverless deployment each instance enforces its own window — it bounds
 * bursts and abuse, it is not a global quota. The client key is the first
 * `X-Forwarded-For` hop (set by the hosting proxy) falling back to the socket
 * address, since `req.ip` would be the proxy itself without `trust proxy`.
 */
function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export function rateLimit({
  name,
  windowMs,
  max,
}: {
  name: string;
  windowMs: number;
  max: number;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // Opportunistic cleanup so the map can't grow without bound.
    if (hits.size > 5000) {
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(key);
      }
    }

    const key = clientKey(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      next(new AppError(429, "RATE_LIMITED", `Too many ${name} requests. Please slow down.`));
      return;
    }
    next();
  };
}

/** `/media/*`: upload slots, confirmations and signed access URLs. Generous enough for a busy office behind one IP. */
export const mediaRateLimit = rateLimit({ name: "media", windowMs: 60_000, max: 300 });

/** `GET /settings/branding`: public, unauthenticated. */
export const brandingRateLimit = rateLimit({ name: "branding", windowMs: 60_000, max: 120 });
