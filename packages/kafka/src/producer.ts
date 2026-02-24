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
      retry: kafkaConfig.retry,
      logLevel: kafkaConfig.logLevel,
    });
    producer = kafka.producer();
  }
  return producer;
}

export async function connectProducer(): Promise<void> {
  if (!kafkaConfig.enabled) return;
  const p = getProducer();
  await p.connect();
}

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
