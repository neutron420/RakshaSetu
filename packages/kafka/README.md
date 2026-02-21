# @rakshasetu/kafka

Shared Kafka client for RakshaSetu: producer (used by **user-be** outbox) and consumer helpers (for separate workers).

## Layout

```
packages/kafka/
├── src/
│   ├── config.ts    # KAFKA_BROKERS, KAFKA_CLIENT_ID, KAFKA_ENABLED
│   ├── topics.ts    # Topic names + eventType → topic mapping
│   ├── producer.ts  # connect, disconnect, sendOutboxMessage, send
│   ├── consumer.ts  # createConsumer, runConsumer, disconnectConsumer
│   └── index.ts     # re-exports
├── package.json
├── tsconfig.json
└── .env.example
```

## Env (in app that uses this package, e.g. user-be)

- `KAFKA_BROKERS` – default `localhost:9092`
- `KAFKA_CLIENT_ID` – default `rakshasetu`
- `KAFKA_ENABLED` – set to `false` to disable producing (e.g. local dev without Kafka)

## Topics

| Topic | When produced |
|-------|----------------|
| `rakshasetu.incidents.created` | Incident created |
| `rakshasetu.incidents.updated` | Incident updated |
| `rakshasetu.assignments.created` | Assignment created |
| `rakshasetu.assignments.updated` | Assignment status updated |
| `rakshasetu.sos.reported` | (reserved; add to outbox in user-be if needed) |

## Producer (user-be)

user-be outbox worker calls `sendOutboxMessage(msg)` for each claimed outbox row. Only events with a topic mapping are sent; others are no-op when Kafka is enabled.

## Consumer (separate app/worker)

```ts
import { runConsumer, disconnectConsumer, TOPICS } from "@rakshasetu/kafka";

const consumer = await runConsumer(
  "my-worker-group",
  [TOPICS.INCIDENTS_UPDATED, TOPICS.ASSIGNMENTS_CREATED],
  async ({ topic, partition, message }) => {
    const value = JSON.parse(message.value?.toString() ?? "{}");
    console.log(topic, value);
  }
);

// On shutdown:
await disconnectConsumer();
```

## Build (optional)

For a production build that emits JS:

```bash
cd packages/kafka && bun run build
```

Then point `main`/`exports` at `dist/` if you prefer running from compiled output.
