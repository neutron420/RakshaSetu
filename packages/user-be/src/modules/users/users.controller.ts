import type { Request, Response } from "express";
import { ok } from "../../common/utils/response";
import { requireAuth } from "../../common/utils/require-auth";
import { getMyProfile, updateMyProfile } from "./users.service";

export async function getMe(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await getMyProfile(user.id);
  return ok(res, "Profile fetched", data);
}

export async function patchMe(req: Request, res: Response) {
  const user = requireAuth(req);
  const data = await updateMyProfile(user.id, req.body);
  return ok(res, "Profile updated", data);
}
