import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { sosRateLimit } from "../common/middleware/rate-limit.middleware";
import { validateBody } from "../common/middleware/validate.middleware";
import { createSos, listMySosReports } from "../modules/sos/sos.controller";
import { createSosSchema } from "../modules/sos/sos.schema";

export const sosRouter = Router();

sosRouter.post("/", authMiddleware, sosRateLimit, validateBody(createSosSchema), createSos);
sosRouter.get("/my-reports", authMiddleware, listMySosReports);
