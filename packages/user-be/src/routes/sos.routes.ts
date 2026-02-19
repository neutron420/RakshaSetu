import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { sosRateLimit } from "../common/middleware/rate-limit.middleware";
import { validateBody } from "../common/middleware/validate.middleware";
import {
  addMedia,
  createSos,
  generateUploadUrl,
  getMedia,
  listMySosReports,
} from "../modules/sos/sos.controller";
import { addMediaSchema, createSosSchema } from "../modules/sos/sos.schema";

export const sosRouter = Router();

sosRouter.post("/", authMiddleware, validateBody(createSosSchema), createSos);
sosRouter.get("/my", authMiddleware, listMySosReports);
sosRouter.get("/upload-url", authMiddleware, generateUploadUrl);
sosRouter.post("/:reportId/media", authMiddleware, validateBody(addMediaSchema), addMedia);
sosRouter.get("/:reportId/media", authMiddleware, getMedia);
