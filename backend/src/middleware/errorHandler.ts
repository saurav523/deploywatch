import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      data: null,
      error: { message: "Validation failed", details: err.flatten() },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ data: null, error: { message: err.message } });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({ data: null, error: { message: "Internal server error" } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ data: null, error: { message: `No route for ${req.method} ${req.path}` } });
}
