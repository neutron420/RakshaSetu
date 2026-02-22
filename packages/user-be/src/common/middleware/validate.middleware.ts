import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.query);
    // req.query is read-only in Bun, so mutate in-place instead of reassigning
    Object.keys(req.query).forEach((k) => delete (req.query as any)[k]);
    Object.assign(req.query, parsed);
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.params);
    // req.params is read-only in Bun, so mutate in-place instead of reassigning
    Object.keys(req.params).forEach((k) => delete (req.params as any)[k]);
    Object.assign(req.params, parsed);
    next();
  };
}
