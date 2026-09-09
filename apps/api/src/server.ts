// Must run before any other import: populates process.env from .env (no-op if the
// file doesn't exist, e.g. in production where the platform injects env vars directly;
// never overrides an already-set variable). config/env.ts reads process.env at import
// time, so this has to come first.
import "dotenv/config";

import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on port ${env.PORT} (${env.NODE_ENV})`);
});

server.on("error", (error) => {
  console.error("[api] failed to start:", error);
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`[api] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
