import type { Request, Response } from "express";
import { ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import * as service from "./upvotes.service";
import { getIncidentMedia } from "./incident-media.service";


export async function toggleUpvote(req: Request, res: Response) {
  const user = requireAuth(req);
  const incidentId = req.params.id as string;
  const data = await service.toggleUpvote(incidentId, user.id);
  return ok(res, data.voted ? "Upvoted" : "Upvote removed", data);
}


export async function getUpvotes(req: Request, res: Response) {
  const user = requireAuth(req);
  const incidentId = req.params.id as string;
  const data = await service.getUpvoteInfo(incidentId, user.id);
  return ok(res, "Upvote info fetched", data);
}


export async function batchGetUpvotes(req: Request, res: Response) {
  const user = requireAuth(req);
  const { incidentIds } = req.body as { incidentIds: string[] };
  const data = await service.getUpvotesForIncidents(incidentIds || [], user.id);
  return ok(res, "Batch upvote info fetched", data);
}


export async function getMedia(req: Request, res: Response) {
  requireAuth(req);
  const incidentId = req.params.id as string;
  const data = await getIncidentMedia(incidentId);
  return ok(res, "Incident media fetched", data);
}
