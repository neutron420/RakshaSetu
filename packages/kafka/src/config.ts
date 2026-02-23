
const brokers = process.env.KAFKA_BROKERS ?? "localhost:9092";
const clientId = process.env.KAFKA_CLIENT_ID ?? "rakshasetu";
const enabled = process.env.KAFKA_ENABLED === "true";

export const kafkaConfig = {
  brokers: brokers.split(",").map((b) => b.trim()),
  clientId,
  enabled,
} as const;
