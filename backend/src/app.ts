import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300 });
  const authLimiter = rateLimit({ windowMs: 60_000, limit: 20 });
  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1", apiLimiter);

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
