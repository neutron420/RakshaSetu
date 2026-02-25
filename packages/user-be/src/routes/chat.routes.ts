import { Router } from "express";
import { chatWithRakshaBot } from "../modules/chat/chat.controller";
import { authMiddleware } from "../common/middleware/auth.middleware";

export const chatRouter = Router();

chatRouter.post("/", authMiddleware, chatWithRakshaBot);
