import type { Request, Response } from "express";
import { created, ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import * as service from "./assignments.service";

export async function assignToIncident(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await service.assign(req.params.id as string, user.id, req.body);
  return created(res, "Assignment created", data);
}

export async function updateAssignmentStatus(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await service.updateStatus(req.params.id as string, req.body, user.id);
  return ok(res, "Assignment status updated", data);
}

export async function getMyAssignments(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await service.getMyAssignments(user.id);
  return ok(res, "Assignments fetched", data);
}

export async function getIncidentAssignments(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.getIncidentAssignments(req.params.id as string);
  return ok(res, "Incident assignments fetched", data);
}
