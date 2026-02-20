import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { requireRole } from "../common/middleware/require-role.middleware";
import { validateBody, validateParams, validateQuery } from "../common/middleware/validate.middleware";
import {
  createIncident,
  getIncidentById,
  linkReportToIncident,
  listIncidents,
  updateIncident,
} from "../modules/incidents/incidents.controller";
import {
  createIncidentSchema,
  linkReportSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema,
  uuidParamSchema,
} from "../modules/incidents/incidents.schema";

export const incidentsRouter = Router();

incidentsRouter.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  validateBody(createIncidentSchema),
  createIncident,
);

incidentsRouter.get(
  "/",
  authMiddleware,
  validateQuery(listIncidentsQuerySchema),
  listIncidents,
);

incidentsRouter.get(
  "/:id",
  authMiddleware,
  validateParams(uuidParamSchema),
  getIncidentById,
);

incidentsRouter.patch(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  validateParams(uuidParamSchema),
  validateBody(updateIncidentSchema),
  updateIncident,
);

incidentsRouter.post(
  "/:id/link-report",
  authMiddleware,
  requireRole("ADMIN"),
  validateParams(uuidParamSchema),
  validateBody(linkReportSchema),
  linkReportToIncident,
);
