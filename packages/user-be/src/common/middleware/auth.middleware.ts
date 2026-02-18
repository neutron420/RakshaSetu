import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../../../../../prisma/generated/prisma";
import { AppError } from "../utils/app-error";
import { env } from "../../config/env";

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Unauthorized", 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }

  next();
}
