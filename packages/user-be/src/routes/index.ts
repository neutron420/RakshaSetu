import { Router } from "express";
import { assignmentsRouter } from "./assignments.routes";
import { authRouter } from "./auth.routes";
import { incidentsRouter } from "./incidents.routes";
import { sosRouter } from "./sos.routes";
import { teamsRouter } from "./teams.routes";
import { timelineRouter } from "./timeline.routes";
import { usersRouter } from "./users.routes";
import { reliefCentersRouter } from "../modules/relief-centers/relief-centers.controller";
import { broadcast } from "../ws";

export const apiRouter = Router();

apiRouter.post("/test-alert", (req, res) => {
  const { disasterType, location, severity } = req.body;
  broadcast({
    type: "EMERGENCY_ALERT",
    payload: {
      disasterType,
      location,
      severity
    }
  });
  res.json({ success: true, message: "Emergency alert broadcasted" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/sos", sosRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/teams", teamsRouter);
apiRouter.use("/relief-centers", reliefCentersRouter);
apiRouter.use("/", assignmentsRouter);   // /incidents/:id/assign, /assignments/*
apiRouter.use("/", timelineRouter);      // /incidents/:id/timeline

