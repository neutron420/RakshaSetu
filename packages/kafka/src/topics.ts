/**
 * Topic names and mapping from outbox eventType → topic.
 * Single source of truth for producers and consumers.
 */
export const TOPICS = {
  SOS_REPORTED: "rakshasetu.sos.reported",
  INCIDENTS_CREATED: "rakshasetu.incidents.created",
  INCIDENTS_UPDATED: "rakshasetu.incidents.updated",
  ASSIGNMENTS_CREATED: "rakshasetu.assignments.created",
  ASSIGNMENTS_UPDATED: "rakshasetu.assignments.updated",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Map outbox eventType to Kafka topic. Returns null if event should not be published to Kafka. */
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
    default:
      return null;
  }
}
