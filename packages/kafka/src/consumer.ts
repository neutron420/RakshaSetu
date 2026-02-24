import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { kafkaConfig } from "./config.js";
import { TOPICS, type TopicName } from "./topics.js";

let kafka: Kafka | null = null;
let consumer: Consumer | null = null;

export function createConsumer(groupId: string): Consumer {
  if (!kafka) {
    kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
      retry: kafkaConfig.retry,
      logLevel: kafkaConfig.logLevel,
    });
  }
  consumer = kafka.consumer({ groupId });
  return consumer;
}


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
   
      }
    },
  });
  return c;
}

export async function disconnectConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    kafka = null;
  }
}
