/**
 * Kafka package config. Load .env from repo root or packages/kafka.
 */
const brokers = process.env.KAFKA_BROKERS ?? "localhost:9092";
const clientId = process.env.KAFKA_CLIENT_ID ?? "rakshasetu";
/** Only enable when explicitly set to "true"; default false so dev works without Kafka. */
const enabled = process.env.KAFKA_ENABLED === "true";

export const kafkaConfig = {
  brokers: brokers.split(",").map((b) => b.trim()),
  clientId,
  /** When false, producer sends no messages (e.g. dev without Kafka). */
  enabled,
} as const;
