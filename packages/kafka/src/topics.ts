export const TOPICS = {
  SOS_REPORTED: "rakshasetu.sos.reported",
  INCIDENTS_CREATED: "rakshasetu.incidents.created",
  INCIDENTS_UPDATED: "rakshasetu.incidents.updated",
  ASSIGNMENTS_CREATED: "rakshasetu.assignments.created",
  ASSIGNMENTS_UPDATED: "rakshasetu.assignments.updated",
  NATURAL_DISASTER_ALERT: "rakshasetu.alerts.disaster",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

export function getTopicForEventType(eventType: string): string | null {
  switch (eventType) {
    case "IncidentCreated":
      return TOPICS.INCIDENTS_CREATED;
    case "IncidentUpdated":
      return TOPICS.INCIDENTS_UPDATED;
    case "AssignmentCreated":
      return TOPICS.ASSIGNMENTS_CREATED;
    case "AssignmentStatusUpdated":
      return TOPICS.ASSIGNMENTS_UPDATED;
    case "NaturalDisasterAlert":
      return TOPICS.NATURAL_DISASTER_ALERT;
    default:
      return null;
  }
}
