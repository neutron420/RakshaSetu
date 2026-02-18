import type { Request } from "express";
import { AppError } from "./app-error";


export function requireAuth(req: Request) {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  return req.user;
}
