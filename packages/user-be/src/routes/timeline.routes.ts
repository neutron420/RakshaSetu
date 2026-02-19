import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { validateParams } from "../common/middleware/validate.middleware";
import { getIncidentTimeline } from "../modules/timeline/timeline.controller";
import { z } from "zod";

const uuidParamSchema = z.object({ id: z.string().uuid() });

export const timelineRouter = Router();

timelineRouter.get(
  "/incidents/:id/timeline",
  authMiddleware,
  validateParams(uuidParamSchema),
  getIncidentTimeline,
);
