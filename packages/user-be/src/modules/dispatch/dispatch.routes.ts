import { Router } from "express";
import { handleDispatchResponse } from "./dispatch.controller";
import { authMiddleware } from "../../common/middleware/auth.middleware";

export const dispatchRouter = Router();

// Routes for volunteers to accept or decline a dispatch ping
// POST /api/v1/dispatch/:incidentId/respond
dispatchRouter.post("/:incidentId/respond", authMiddleware, handleDispatchResponse as any);
