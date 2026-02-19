import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { requireRole } from "../common/middleware/require-role.middleware";
import { validateBody, validateParams } from "../common/middleware/validate.middleware";
import {
  assignToIncident,
  getIncidentAssignments,
  getMyAssignments,
  updateAssignmentStatus,
} from "../modules/assignments/assignments.controller";
import {
  createAssignmentSchema,
  updateAssignmentStatusSchema,
  uuidParamSchema,
} from "../modules/assignments/assignments.schema";

export const assignmentsRouter = Router();

// Admin assigns a team/responder to an incident
// Admin assigns a team/responder to an incident
/*
assignmentsRouter.post(
  "/incidents/:id/assign",
  authMiddleware,
  requireRole("ADMIN"),
  validateParams(uuidParamSchema),
  validateBody(createAssignmentSchema),
  assignToIncident,
);
*/

// List assignments for a specific incident
assignmentsRouter.get(
  "/incidents/:id/assignments",
  authMiddleware,
  validateParams(uuidParamSchema),
  getIncidentAssignments,
);

// Responder updates their assignment status
/*
assignmentsRouter.patch(
  "/assignments/:id/status",
  authMiddleware,
  requireRole("ADMIN", "RESPONDER"),
  validateParams(uuidParamSchema),
  validateBody(updateAssignmentStatusSchema),
  updateAssignmentStatus,
);

// Responder views their own assignments
assignmentsRouter.get(
  "/assignments/my",
  authMiddleware,
  requireRole("RESPONDER"),
  getMyAssignments,
);
*/
