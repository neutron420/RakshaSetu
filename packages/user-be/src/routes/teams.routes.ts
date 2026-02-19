import { Router } from "express";
import { authMiddleware } from "../common/middleware/auth.middleware";
import { requireRole } from "../common/middleware/require-role.middleware";
import { validateBody, validateParams } from "../common/middleware/validate.middleware";
import {
  addMember,
  createTeam,
  getTeamById,
  listTeams,
  removeMember,
  toggleDuty,
} from "../modules/teams/teams.controller";
import {
  addMemberSchema,
  createTeamSchema,
  teamMemberParamsSchema,
  toggleDutySchema,
  uuidParamSchema,
} from "../modules/teams/teams.schema";

export const teamsRouter = Router();

/*
teamsRouter.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  validateBody(createTeamSchema),
  createTeam,
);
*/

teamsRouter.get("/", authMiddleware, listTeams);

teamsRouter.get(
  "/:id",
  authMiddleware,
  validateParams(uuidParamSchema),
  getTeamById,
);

/*
teamsRouter.post(
  "/:id/members",
  authMiddleware,
  requireRole("ADMIN"),
  validateParams(uuidParamSchema),
  validateBody(addMemberSchema),
  addMember,
);

teamsRouter.delete(
  "/:id/members/:userId",
  authMiddleware,
  requireRole("ADMIN"),
  validateParams(teamMemberParamsSchema),
  removeMember,
);

teamsRouter.patch(
  "/:id/members/:userId/duty",
  authMiddleware,
  requireRole("ADMIN", "RESPONDER"),
  validateParams(teamMemberParamsSchema),
  validateBody(toggleDutySchema),
  toggleDuty,
);
*/
