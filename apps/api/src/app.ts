import express, { type Express } from "express";
import cors from "cors";
import { createRequire } from "node:module";
import { healthResponseSchema, type HealthResponse } from "@internal-training/shared";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { routes } from "./routes/index.js";

// Loaded via createRequire (rather than a static import) because helmet's
// declared default-export interop is resolved inconsistently across
// TypeScript module-resolution configurations; require() always returns the
// callable directly, matching helmet's actual CJS runtime shape.
const helmet = createRequire(import.meta.url)("helmet") as typeof import("helmet").default;

export const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
  }),
);
app.use(express.json());

// Infrastructure-level health check (not versioned, no auth, no sensitive data).
app.get("/health", (_req, res) => {
  const body: HealthResponse = healthResponseSchema.parse({ data: { status: "ok" } });
  res.json(body);
});

app.use("/api/v1", routes);

// Must be registered last: Express identifies error middleware by its 4-argument arity.
app.use(errorHandler);
