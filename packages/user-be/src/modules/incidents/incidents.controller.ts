import type { Request, Response } from "express";
import { created, ok, paginated } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import * as service from "./incidents.service";

export async function createIncident(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await service.create(req.body);
  return created(res, "Incident created", data);
}

export async function getIncidentById(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.getById(req.params.id as string);
  return ok(res, "Incident fetched", data);
}

export async function listIncidents(req: Request, res: Response) {
  requireAuth(req);
  const result = await service.list(req.query as any);
  return paginated(res, "Incidents fetched", result.data, result.meta);
}

export async function updateIncident(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await service.update(req.params.id as string, req.body, user.id);
  return ok(res, "Incident updated", data);
}

export async function linkReportToIncident(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.linkReport(req.params.id as string, req.body);
  return ok(res, "Report linked to incident", data);
}
