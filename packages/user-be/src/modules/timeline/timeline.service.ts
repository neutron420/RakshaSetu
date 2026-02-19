import { createStatusEvent, listEventsByIncident } from "./timeline.repo";

export async function logStatusChange(data: {
  incidentId: string;
  actorUserId: string | null;
  previousStatus: string | null;
  newStatus: string;
  source?: string;
  message?: string;
}) {
  return createStatusEvent(data);
}

export async function getTimeline(incidentId: string) {
  return listEventsByIncident(incidentId);
}
