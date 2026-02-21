import { Kafka, Producer, ProducerRecord } from "kafkajs";
import { kafkaConfig } from "./config.js";
import { getTopicForEventType } from "./topics.js";

let kafka: Kafka | null = null;
let producer: Producer | null = null;

function getProducer(): Producer {
  if (!producer) {
    kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });
    producer = kafka.producer();
  }
  return producer;
}

/** Call once at app startup (e.g. before processing outbox). */
export async function connectProducer(): Promise<void> {
  if (!kafkaConfig.enabled) return;
  const p = getProducer();
  await p.connect();
}

/** Call on app shutdown. */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    kafka = null;
  }
}

export interface OutboxMessage {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  partitionKey: string;
  payload: unknown;
}

/**
 * Send a single outbox message to the correct Kafka topic.
 * No-op if KAFKA_ENABLED is false or eventType has no topic mapping.
 */
export async function sendOutboxMessage(msg: OutboxMessage): Promise<boolean> {
  if (!kafkaConfig.enabled) return false;

  const topic = getTopicForEventType(msg.eventType);
  if (!topic) return false;

  const p = getProducer();
  const record: ProducerRecord = {
    topic,
    messages: [
      {
        key: msg.partitionKey,
        value: JSON.stringify({
          eventType: msg.eventType,
          aggregateType: msg.aggregateType,
          aggregateId: msg.aggregateId,
          payload: msg.payload,
          _meta: { outboxId: msg.id },
        }),
      },
    ],
  };
  await p.send(record);
  return true;
}

/**
 * Send a raw message to a topic (for use outside outbox).
 */
export async function send(topic: string, key: string, value: string | object): Promise<void> {
  if (!kafkaConfig.enabled) return;

  const p = getProducer();
  await p.send({
    topic,
    messages: [
      {
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      },
    ],
  });
}
