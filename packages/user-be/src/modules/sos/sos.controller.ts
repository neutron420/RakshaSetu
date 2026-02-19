import type { Request, Response } from "express";
import { created, ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import { getMyReports, submitSos } from "./sos.service";
import { registerMedia, getReportMedia } from "./sos-media.service";

export async function createSos(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await submitSos(user.id, req.body);
  return created(res, "SOS submitted", data);
}

export async function listMySosReports(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await getMyReports(user.id);
  return ok(res, "Reports fetched", data);
}

export async function addMedia(req: Request, res: Response) {
  requireAuth(req);
  const data = await registerMedia(req.params.reportId as string, req.body);
  return created(res, "Media added", data);
}

export async function getMedia(req: Request, res: Response) {
  requireAuth(req);
  const data = await getReportMedia(req.params.reportId as string);
  return ok(res, "Media fetched", data);
}

import { getUploadUrl } from "../../common/services/storage.service";
import { randomUUID } from "node:crypto";

export async function generateUploadUrl(req: Request, res: Response) {
  requireAuth(req);
  const { contentType = "image/jpeg" } = req.query;
  const key = `sos/${randomUUID()}.${(contentType as string).split("/")[1]}`;
  
  const data = await getUploadUrl(key, contentType as string);
  return ok(res, "Upload URL generated", data);
}
