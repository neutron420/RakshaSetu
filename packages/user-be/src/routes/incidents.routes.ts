import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { requireRole } from "../common/middleware/require-role.middleware";
import { validateBody, validateParams, validateQuery } from "../common/middleware/validate.middleware";
import {
  createIncident,
  getIncidentById,
  linkReportToIncident,
  listIncidents,
  listNearbyIncidents,
  updateIncident,
} from "../modules/incidents/incidents.controller";
import {
  createIncidentSchema,
  linkReportSchema,
  listIncidentsQuerySchema,
  listNearbyQuerySchema,
  updateIncidentSchema,
  uuidParamSchema,
} from "../modules/incidents/incidents.schema";
import {
  toggleUpvote,
  getUpvotes,
  batchGetUpvotes,
  getMedia,
} from "../modules/incidents/upvotes.controller";

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
  "/nearby",
  authMiddleware,
  validateQuery(listNearbyQuerySchema),
  listNearbyIncidents,
);


// Batch upvotes — must be before /:id routes
incidentsRouter.post(
  "/upvotes/batch",
  authMiddleware,
  batchGetUpvotes,
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

// Upvote routes
incidentsRouter.post(
  "/:id/upvote",
  authMiddleware,
  validateParams(uuidParamSchema),
  toggleUpvote,
);

incidentsRouter.get(
  "/:id/upvotes",
  authMiddleware,
  validateParams(uuidParamSchema),
  getUpvotes,
);

incidentsRouter.get(
  "/:id/media",
  authMiddleware,
  validateParams(uuidParamSchema),
  getMedia,
);
