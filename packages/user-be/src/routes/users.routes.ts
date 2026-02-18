import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateBody } from "../common/middleware/validate.middleware";
import { getMe, patchMe } from "../modules/users/users.controller";
import { updateMeSchema } from "../modules/users/users.schema";

export const usersRouter = Router();

usersRouter.get("/me", authMiddleware, getMe);
usersRouter.patch("/me", authMiddleware, validateBody(updateMeSchema), patchMe);
