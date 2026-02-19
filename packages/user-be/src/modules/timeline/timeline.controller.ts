import type { Request, Response } from "express";
import { ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import { getTimeline } from "./timeline.service";

export async function getIncidentTimeline(req: Request, res: Response) {
  requireAuth(req);
  const data = await getTimeline(req.params.id as string);
  return ok(res, "Timeline fetched", data);
}
