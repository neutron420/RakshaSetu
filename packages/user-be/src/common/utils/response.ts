import type { Response } from "express";

export function ok<T>(res: Response, message: string, data: T) {
  return res.status(200).json({ success: true, message, data });
}

export function created<T>(res: Response, message: string, data: T) {
  return res.status(201).json({ success: true, message, data });
}

export function noContent(res: Response) {
  return res.status(204).end();
}

export function fail(res: Response, statusCode: number, message: string, details?: unknown) {
  return res.status(statusCode).json({ success: false, message, details });
}

export function paginated<T>(
  res: Response,
  message: string,
  data: T[],
  meta: { page: number; limit: number; total: number },
) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
}
