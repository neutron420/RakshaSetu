import { Router } from "express";
import multer from "multer";
import { chatWithRakshaBot, chatWithRakshaBotAudio, chatWithRakshaBotTTS } from "../modules/chat/chat.controller";
import { authMiddleware } from "../common/middleware/auth.middleware";

export const chatRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

chatRouter.post("/", authMiddleware, chatWithRakshaBot);
chatRouter.post("/audio", authMiddleware, upload.single("audio"), chatWithRakshaBotAudio);
chatRouter.post("/tts", authMiddleware, chatWithRakshaBotTTS);
