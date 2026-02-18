import "express";
import type { UserRole } from "../../../../prisma/generated/prisma";

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      user?: UserContext;
    }
  }
}

export {};
