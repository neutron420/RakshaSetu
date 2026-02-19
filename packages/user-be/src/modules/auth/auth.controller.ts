import type { Request, Response } from "express";
import { created, ok } from "../../common/utils/response";
import { login, signup, requestOtp, verifyOtp } from "./auth.service";

export async function createAccount(req: Request, res: Response) {
  const data = await signup(req.body);
  return created(res, "Account created", data);
}

export async function loginUser(req: Request, res: Response) {
  const data = await login(req.body);
  return ok(res, "Login successful", data);
}

export async function sendOtpHandler(req: Request, res: Response) {
  const data = await requestOtp(req.body);
  return ok(res, "OTP sent", data);
}

export async function verifyOtpHandler(req: Request, res: Response) {
  const data = await verifyOtp(req.body);
  return ok(res, "OTP verified", data);
}
