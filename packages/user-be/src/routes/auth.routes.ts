import { Router } from "express";
import { authRateLimit } from "../common/middleware/rate-limit.middleware";
import { validateBody } from "../common/middleware/validate.middleware";
import { createAccount, loginUser, sendOtpHandler, verifyOtpHandler } from "../modules/auth/auth.controller";
import { loginSchema, requestOtpSchema, signupSchema, verifyOtpSchema } from "../modules/auth/auth.schema";

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, validateBody(signupSchema), createAccount);
authRouter.post("/login", authRateLimit, validateBody(loginSchema), loginUser);

authRouter.post("/otp/request", authRateLimit, validateBody(requestOtpSchema), sendOtpHandler);
authRouter.post("/otp/verify", authRateLimit, validateBody(verifyOtpSchema), verifyOtpHandler);
