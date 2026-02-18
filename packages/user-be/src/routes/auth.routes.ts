import { Router } from "express";
import { authRateLimit } from "../common/middleware/rate-limit.middleware";
import { validateBody } from "../common/middleware/validate.middleware";
import { login, signup } from "../modules/auth/auth.controller";
import { loginSchema, signupSchema } from "../modules/auth/auth.schema";

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, validateBody(signupSchema), signup);
authRouter.post("/login", authRateLimit, validateBody(loginSchema), login);
