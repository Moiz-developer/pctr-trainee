import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { healthResponseSchema, type HealthResponse } from "@internal-training/shared";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { routes } from "./routes/index.js";

export const app: Express = express();

// A static import keeps helmet traceable by Vercel's dependency bundler.
// helmet's default-export type resolves inconsistently across TypeScript
// module-resolution configurations, so it's cast explicitly to its declared
// callable type rather than relying on that resolution.
app.use((helmet as unknown as typeof import("helmet").default)());
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
  }),
);
app.use(express.json());

// Infrastructure-level health check (not versioned, no auth, no sensitive data).
app.get("/health", (_req, res) => {
  const body: HealthResponse = healthResponseSchema.parse({ data: { status: "ok" } });

  // TEMPORARY diagnostic (remove after the RUNTIME_DATABASE_URL investigation is
  // resolved): reports only non-sensitive, parsed connection-string shape — never
  // the password, never the raw string.
  let dbUrlDiagnostic: Record<string, unknown> = { exists: false };
  if (env.RUNTIME_DATABASE_URL) {
    try {
      const parsed = new URL(env.RUNTIME_DATABASE_URL);
      dbUrlDiagnostic = {
        exists: true,
        protocol: parsed.protocol.replace(/:$/, ""),
        hostname: parsed.hostname,
        port: parsed.port,
        database: parsed.pathname.replace(/^\//, ""),
        username: parsed.username,
        hasPassword: parsed.password.length > 0,
      };
    } catch {
      dbUrlDiagnostic = { exists: true, parseError: true };
    }
  }

  res.json({ ...body, _diagnostic: { runtimeDatabaseUrl: dbUrlDiagnostic } });
});

app.use("/api/v1", routes);

// Must be registered last: Express identifies error middleware by its 4-argument arity.
app.use(errorHandler);
