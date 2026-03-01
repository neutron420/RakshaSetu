import { Router } from "express";
import { assignmentsRouter } from "./assignments.routes";
import { authRouter } from "./auth.routes";
import { incidentsRouter } from "./incidents.routes";
import { sosRouter } from "./sos.routes";
import { bleRelayRouter } from "../modules/sos/ble-relay.routes";
import { teamsRouter } from "./teams.routes";
import { timelineRouter } from "./timeline.routes";
import { usersRouter } from "./users.routes";
import { chatRouter } from "./chat.routes";
import { reliefCentersRouter } from "../modules/relief-centers/relief-centers.controller";
import { dispatchRouter } from "../modules/dispatch/dispatch.routes";
import { broadcast } from "../ws";
import { pollWeatherAlerts } from "../modules/alerts/weather-ingestion.service";

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

apiRouter.post("/test/weather-poll", async (_req, res) => {
  console.log("[Test] Manually triggering weather poll...");
  await pollWeatherAlerts();
  res.json({ success: true, message: "Weather poll triggered" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/sos", sosRouter);
apiRouter.use("/sos", bleRelayRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/teams", teamsRouter);
apiRouter.use("/relief-centers", reliefCentersRouter);
apiRouter.use("/dispatch", dispatchRouter);
apiRouter.use("/", assignmentsRouter);  
apiRouter.use("/", timelineRouter);      
