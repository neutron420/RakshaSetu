import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../../../../../prisma/generated/prisma";
import { AppError } from "../utils/app-error";

/**
 * Middleware factory that restricts access to users with one of the specified roles.
 * Must be used AFTER `authMiddleware`.
 *
 * @example
 * router.delete("/incident/:id", authMiddleware, requireRole("ADMIN"), deleteIncident);
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    if (!roles.includes(req.user.role as UserRole)) {
      throw new AppError("Forbidden — insufficient permissions", 403);
    }

    next();
  };
}
