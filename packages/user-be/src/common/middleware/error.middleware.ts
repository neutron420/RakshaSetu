import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../../../../../prisma/generated/prisma";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";
import { env } from "../../config/env";

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      details: err.flatten(),
    });
    return;
  }


  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }
  
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[])?.join(", ") ?? "field";
        res.status(409).json({
          success: false,
          message: `A record with that ${target} already exists`,
        });
        return;
      }
      case "P2025":
        res.status(404).json({
          success: false,
          message: "Record not found",
        });
        return;
      case "P2003":
        res.status(400).json({
          success: false,
          message: "Related record not found — foreign key constraint failed",
        });
        return;
    }
  }

  // ── Prisma validation errors ──
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: "Invalid data sent to database",
    });
    return;
  }

  // ── Catch-all ──
  const message = err instanceof Error ? err.message : "Internal server error";

  if (env.nodeEnv !== "test") {
    console.error("[unhandled error]", err);
  }

  res.status(500).json({ success: false, message });
}
