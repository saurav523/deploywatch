import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import { AppError } from "../utils/AppError";
import { UserRole } from "../models/User";

/**
 * requireRole restricts a route to a set of roles.
 * Used for actions with real operational consequence (rollback, cluster
 * registration/deletion, notification-rule changes) rather than every
 * read endpoint, matching the RBAC design in the architecture doc.
 */
export function requireRole(...allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Unauthenticated", 401));
    if (!allowed.includes(req.user.role as UserRole)) {
      return next(new AppError("Insufficient permissions for this action", 403));
    }
    next();
  };
}
