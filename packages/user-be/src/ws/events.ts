import { broadcast, broadcastToRole, sendToUser } from "./index";

export function emitSosCreated(reporterId: string, report: {
  reportId: string;
  category: string;
  latitude: number;
  longitude: number;
  reportedAt: Date;
}) {

  sendToUser(reporterId, {
    type: "sos:submitted",
    payload: report,
  });
  
  broadcastToRole("RESPONDER", {
    type: "sos:new",
    payload: { ...report, reporterId },
  });

  broadcastToRole("ADMIN", {
    type: "sos:new",
    payload: { ...report, reporterId },
  });
}

export function emitSosStatusUpdate(reporterId: string, data: {
  reportId: string;
  status: string;
  previousStatus: string;
}) {
  sendToUser(reporterId, {
    type: "sos:status-update",
    payload: data,
  });
}

export function emitIncidentUpdate(data: {
  incidentId: string;
  status: string;
  priority: string;
  title: string;
  category: string;
  centroidLat: number;
  centroidLng: number;
}) {
  broadcast({
    type: "incident:update",
    payload: data,
  });
}

export function emitIncidentAssignment(responderId: string, data: {
  assignmentId: string;
  incidentId: string;
  teamId: string;
  status: string;
}) {
  sendToUser(responderId, {
    type: "assignment:new",
    payload: data,
  });
}
