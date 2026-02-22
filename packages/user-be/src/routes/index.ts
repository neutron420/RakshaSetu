import { Router } from "express";
import { assignmentsRouter } from "./assignments.routes";
import { authRouter } from "./auth.routes";
import { incidentsRouter } from "./incidents.routes";
import { sosRouter } from "./sos.routes";
import { teamsRouter } from "./teams.routes";
import { timelineRouter } from "./timeline.routes";
import { usersRouter } from "./users.routes";
import { reliefCentersRouter } from "../modules/relief-centers/relief-centers.controller";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/sos", sosRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/teams", teamsRouter);
apiRouter.use("/relief-centers", reliefCentersRouter);
apiRouter.use("/", assignmentsRouter);   // /incidents/:id/assign, /assignments/*
apiRouter.use("/", timelineRouter);      // /incidents/:id/timeline

