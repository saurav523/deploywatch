import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";

export interface AuthedRequest extends Request {
  user?: { id: string; orgId: string; role: string };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Missing or malformed Authorization header", 401));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, orgId: payload.orgId, role: payload.role };
    next();
  } catch {
    next(new AppError("Invalid or expired access token", 401));
  }
}
