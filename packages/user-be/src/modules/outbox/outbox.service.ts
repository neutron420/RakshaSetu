import { broadcast } from "../../ws";
import { createOutboxMessage, markFailed, markPublished, pollPendingMessages } from "./outbox.repo";

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
 * Poll pending outbox messages and dispatch them via WebSocket.
 * Call this from a setInterval or background worker.
 */
export async function processOutbox(batchSize = 10) {
  const messages = await pollPendingMessages(batchSize);

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
