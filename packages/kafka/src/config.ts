
const brokers = process.env.KAFKA_BROKERS ?? "localhost:9092";
const clientId = process.env.KAFKA_CLIENT_ID ?? "rakshasetu";
const enabled = process.env.KAFKA_ENABLED === "true";

export const kafkaConfig = {
  brokers: brokers.split(",").map((b) => b.trim()),
  clientId,
  enabled,
  logLevel: 1, // LogLevel.ERROR
  retry: {
    initialRetryTime: 1000,
    retries: 10,
    maxRetryTime: 30000,
    factor: 2,
    multiplier: 1.5,
  }
} as const;
