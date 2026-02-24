import { sendOutboxMessage } from "@rakshasetu/kafka";
import { broadcast } from "../../ws";
import { claimPendingMessages, createOutboxMessage, markFailed, markPublished } from "./outbox.repo";

export async function enqueueEvent(data: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  partitionKey: string;
  payload: unknown;
  createdById?: string;
}) {
  return createOutboxMessage(data);
}

/**
 * Claim pending outbox messages (with row lock), dispatch via WebSocket and Kafka.
 * Safe for multiple instances: each message is processed at most once.
 */
export async function processOutbox(batchSize = 10) {
  const messages = await claimPendingMessages(batchSize);

  for (const msg of messages) {
    try {
      broadcast({
        type: `outbox:${msg.eventType}`,
        payload: {
          aggregateType: msg.aggregateType,
          aggregateId: msg.aggregateId,
          data: msg.payload,
        },
      });

      // Also broadcast as a generic EMERGENCY_ALERT if it's a disaster
      if (msg.eventType === "NaturalDisasterAlert") {
        broadcast({
          type: "EMERGENCY_ALERT",
          payload: {
            disasterType: (msg.payload as any).alertType || "Emergency",
            location: (msg.payload as any).place || "Your Area",
            severity: (msg.payload as any).severity || "critical"
          }
        });
      }

      await sendOutboxMessage({
        id: msg.id,
        eventType: msg.eventType,
        aggregateType: msg.aggregateType,
        aggregateId: msg.aggregateId,
        partitionKey: msg.partitionKey,
        payload: msg.payload,
      });

      await markPublished(msg.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await markFailed(msg.id, errorMessage);
    }
  }

  return messages.length;
}
