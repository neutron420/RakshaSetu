# 🚀 Kafka High-Level Design (HLD) - RakshaSetu

This document outlines the architecture, integration, and role of Apache Kafka within the RakshaSetu ecosystem.

## 🏗️ Architecture Overview

RakshaSetu uses Kafka as its **Event Bus** to ensure reliable, asynchronous communication between services. To prevent data loss and ensure atomicity, we implement the **Transactional Outbox Pattern**.

## 📖 How it Works (The Story)

Imagine a citizen reports an **SOS incident**. In a traditional system, the backend might try to save to the database and send a notification at the same time. If the notification service is down, the report is saved but the alert is lost. **RakshaSetu avoids this.**

1.  **The Transaction**: When you submit a report, the `user-be` saves the incident and a "message" into a special `outbox` table in the *same* database transaction. This is atomic—either both happen, or nothing happens.
2.  **The Courier (Outbox Worker)**: A background worker polls this `outbox` table every few seconds. It picks up pending messages and hands them over to **Kafka**.
3.  **The Broadcast**: Kafka takes the message and puts it into a **Topic** (like a specific radio frequency). It holds onto this message safely, even if no one is listening yet.
4.  **The Reaction**: Other services (like the SMS alerter or the AI Clustering engine) "listen" to these topics. When a new message arrives, they react immediately—sending a text to a responder or updating a dashboard—without ever slowing down the main Citizen App.

---

### The Flow of an Event

```mermaid
sequenceDiagram
    participant App as Citizen App / Admin
    participant API as User Backend (Node.js)
    participant DB as PostgreSQL (Outbox Table)
    participant Worker as Outbox Worker (user-be)
    participant Kafka as Kafka Brokers
    participant Consumer as Downstream Workers (Consumers)

    App->>API: Submit SOS / Update Incident
    API->>DB: Save Incident + Insert Outbox Message (Atomic)
    API-->>App: Success Response
    
    loop Every 5s
        Worker->>DB: Claim Pending Messages
        DB-->>Worker: Batch of Messages
        Worker->>Kafka: Publish to Topic (e.g. incidents.created)
        Worker->>DB: Mark Message as Published
    end

    Kafka->>Consumer: Stream Event
    Consumer->>Consumer: Logic (Notifications, Analytics, etc.)
```

### 🛰️ System Topology

This diagram shows how Kafka acts as the central nervous system for RakshaSetu, allowing services to react to changes without direct coupling.

```mermaid
graph TD
    Citizen[Citizen App] -->|SOS/Report| BE[User Backend]
    BE -->|Atomically Writes| DB[(PostgreSQL)]
    
    subgraph "Event Bus Infrastructure"
    DB -.->|Outbox Worker| Kafka{{"Apache Kafka"}}
    end

    Kafka -->|Stream| SMS[SMS/Email Service]
    Kafka -->|Stream| Push[Push Notification Hub]
    Kafka -->|Stream| Analytics[GIS & Risk Analytics]
    Kafka -->|Stream| ML[AI Clustering Engine]

    style Kafka fill:#f96,stroke:#333,stroke-width:4px
```

### 🔁 Outbox Message Lifecycle

We track every event through its lifecycle to ensure "At-Least-Once" delivery.

```mermaid
stateDiagram-v2
    [*] --> PENDING: API Insert (Atomic with Data)
    PENDING --> PROCESSING: Worker Claims (Row Lock)
    PROCESSING --> PUBLISHED: Kafka ACK Received
    PROCESSING --> FAILED: Error Publishing
    FAILED --> PENDING: Automatic Retry
    PUBLISHED --> [*]: Cleanup (Optional)
```

### 📊 Code Structure & Dependencies

This is how the internal pieces of your codebase are wired up:

```mermaid
graph LR
    subgraph "user-be (Main API)"
        Service[Service Layer] --> OutboxSvc[Outbox Service]
        OutboxSvc --> Repository[Outbox Repo]
        Repository --> DB[(PostgreSQL)]
    end

    subgraph "@rakshasetu/kafka (Shared)"
        InternalProducer[Producer Logic]
        InternalConsumer[Consumer Logic]
        TopicsDef[Topics Registry]
    end

    OutboxSvc -->|Imports| InternalProducer
    Worker[Outbox Worker Loop] -->|Polls| Repository
    Worker -->|Uses| InternalProducer
    InternalProducer -->|Publishes| KafkaTopic((Kafka Topic))
    InternalProducer -.->|Looks up| TopicsDef

    style InternalProducer fill:#d4f1f9,stroke:#333
    style InternalConsumer fill:#d4f1f9,stroke:#333
    style TopicsDef fill:#fff2cc,stroke:#333
```

---

## 🌟 Major Roles of Kafka

Kafka is not just a message queue; it's the backbone of our reactive architecture:

1.  **Decoupling Services**: The `user-be` doesn't need to know who is interested in an "Incident Created" event. It just publishes, and any service (SMS, Push Notifications, GIS Analytics) can subscribe.
2.  **Reliability (Outbox Pattern)**: By saving events to the database first, we ensure that if Kafka is down, events aren't lost. They stay in the `outbox` table and are retried until published.
3.  **Scalability**: Kafka allows multiple consumers to process the same stream of events at their own pace without slowing down the main API.
4.  **Data Consistency**: Using the `partitionKey` (usually `incidentId`), we ensure that events for the same entity are processed in the correct order.

---

## 📂 Topics & Event Mapping

Defined in `packages/kafka/src/topics.ts`:

| Topic Name | Purpose | Event Trigger |
| :--- | :--- | :--- |
| `rakshasetu.incidents.created` | Core incident creation | When a new incident is logged or auto-created from SOS. |
| `rakshasetu.incidents.updated` | Real-time updates | Status changes, priority shifts, or new descriptions. |
| `rakshasetu.assignments.created` | Dispatching | When a relief team is assigned to an incident. |
| `rakshasetu.assignments.updated` | Progress tracking | When a team updates their assignment status. |
| `rakshasetu.sos.reported` | Urgent Alerts | Direct feed of raw SOS reports (reserved for high-priority alerts). |

---

## 🛠️ How to Start

### 1. Local Infrastructure (Docker)
Ensure you have Kafka running. If you have a `docker-compose.yml` in the root:
```bash
docker-compose up -d kafka
```

### 2. Configuration
Kafka settings are managed via environment variables in your `.env` file within `packages/user-be`:
```env
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=rakshasetu-local
```

### 3. Initialize Topics
Run the helper script to create the necessary topics in your Kafka broker:
```bash
cd packages/kafka
bun run src/init-topics.ts
```

### 4. Running the Producer (User BE)
The producer starts automatically with the `user-be` server. Ensure the outbox worker is enabled in your server configuration.

### 5. Starting a Consumer
Use the shared `@rakshasetu/kafka` package to build consumers:
```ts
import { runConsumer, TOPICS } from "@rakshasetu/kafka";

await runConsumer("my-group-id", [TOPICS.INCIDENTS_CREATED], async ({ message }) => {
  console.log("New incident received:", message.value.toString());
});
```

---

## 🔍 Directory Structure
- `src/topics.ts`: Single source of truth for topic names.
- `src/producer.ts`: High-performance wrapper for `kafkajs` producer.
- `src/consumer.ts`: Utility for creating resilient consumers.
- `src/init-topics.ts`: Admin script for infrastructure setup.
