import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * Centralized Express error handler (foundation stage).
 * Never leaks stack traces or raw exception messages to the client in production.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (env.NODE_ENV === "production") {
    console.error("[api] unhandled error");
  } else {
    console.error("[api] unhandled error:", err);
  }

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
}
