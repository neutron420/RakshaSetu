import type { Request, Response } from "express";
import { created, noContent, ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import * as service from "./teams.service";

export async function createTeam(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.create(req.body);
  return created(res, "Team created", data);
}

export async function getTeamById(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.getById(req.params.id as string);
  return ok(res, "Team fetched", data);
}

export async function listTeams(_req: Request, res: Response) {
  const data = await service.list();
  return ok(res, "Teams fetched", data);
}

export async function addMember(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.addMember(req.params.id as string, req.body);
  return created(res, "Member added", data);
}

export async function removeMember(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.removeMember(req.params.id as string, req.params.userId as string);
  return ok(res, "Member removed", data);
}

export async function toggleDuty(req: Request, res: Response) {
  requireAuth(req);
  const data = await service.toggleDuty(req.params.id as string, req.params.userId as string, req.body);
  return ok(res, "Duty status updated", data);
}
