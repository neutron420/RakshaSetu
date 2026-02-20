import { broadcast } from "../../ws";
import { claimPendingMessages, createOutboxMessage, markFailed, markPublished } from "./outbox.repo";

/**
 * Enqueue an event into the outbox table.
 * Called by service layers when something important happens.
 */
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
 * Claim pending outbox messages (with row lock) and dispatch via WebSocket.
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

      await markPublished(msg.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await markFailed(msg.id, errorMessage);
    }
  }

  return messages.length;
}
