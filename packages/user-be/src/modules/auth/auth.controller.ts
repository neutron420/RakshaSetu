import type { Request, Response } from "express";
import { created, ok } from "../../common/utils/response";
import { login as loginService, signup as signupService } from "./auth.service";

export async function signup(req: Request, res: Response) {
  const data = await signupService(req.body);
  return created(res, "Signup successful", data);
}

export async function login(req: Request, res: Response) {
  const data = await loginService(req.body);
  return ok(res, "Login successful", data);
}
