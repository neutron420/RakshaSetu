

export { kafkaConfig } from "./config.js";
export { TOPICS, getTopicForEventType, type TopicName } from "./topics.js";
export {
  connectProducer,
  disconnectProducer,
  sendOutboxMessage,
  send,
  type OutboxMessage,
} from "./producer.js";
export {
  createConsumer,
  runConsumer,
  disconnectConsumer,
} from "./consumer.js";
import { init as initTopics } from "./init-topics.js";
export { initTopics };
