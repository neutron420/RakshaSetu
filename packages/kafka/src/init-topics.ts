import { Kafka } from "kafkajs";
import { kafkaConfig } from "./config.js";
import { TOPICS } from "./topics.js";

async function init() {
  if (!kafkaConfig.enabled) {
    console.log("Kafka is disabled via settings. Skipping topic initialization.");
    return;
  }

  console.log("Starting Kafka topic initialization...");
  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-admin`,
    brokers: kafkaConfig.brokers,
  });

  const admin = kafka.admin();

  try {
    await admin.connect();
    console.log("Connected to Kafka admin client.");

    const existingTopics = await admin.listTopics();
    const topicsToCreate = Object.values(TOPICS)
      .filter((topic) => !existingTopics.includes(topic))
      .map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      }));

    if (topicsToCreate.length > 0) {
      console.log(`Creating ${topicsToCreate.length} topics: ${topicsToCreate.map(t => t.topic).join(", ")}`);
      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
      });
      console.log("Topics created successfully.");
    } else {
      console.log("All topics already exist.");
    }
  } catch (err: any) {
    console.error("Failed to initialize topics:", err.message);
  } finally {
    await admin.disconnect();
  }
}

init();
