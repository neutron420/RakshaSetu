import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { kafkaConfig } from "./config.js";
import { TOPICS, type TopicName } from "./topics.js";

let kafka: Kafka | null = null;
let consumer: Consumer | null = null;

/**
 * Create and return a consumer. Call connect() and subscribe() before use.
 * Use this from a separate process (e.g. notification worker, analytics).
 */
export function createConsumer(groupId: string): Consumer {
  if (!kafka) {
    kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });
  }
  consumer = kafka.consumer({ groupId });
  return consumer;
}

/** Run a consumer that processes each message with the given handler. */
export async function runConsumer(
  groupId: string,
  topics: TopicName[],
  eachMessage: (payload: EachMessagePayload) => Promise<void>
): Promise<Consumer> {
  const c = createConsumer(groupId);
  await c.connect();
  await c.subscribe({ topics: [...topics], fromBeginning: false });
  await c.run({
    eachMessage: async (payload) => {
      try {
        await eachMessage(payload);
      } catch (err) {
        console.error("[kafka] eachMessage error:", err);
        // Don't throw: let Kafka commit offset. For at-least-once retry, throw.
      }
    },
  });
  return c;
}

/** Disconnect the consumer (call on shutdown). */
export async function disconnectConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    kafka = null;
  }
}
