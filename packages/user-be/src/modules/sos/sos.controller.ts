import type { Request, Response } from "express";
import { created, ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import { getMyReports, submitSos } from "./sos.service";

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
