# RakshaSetu

**RakshaSetu** (meaning "Bridge of Protection" in Hindi) is a full-stack, real-time disaster management and citizen safety platform. It combines a React Native mobile application with a high-performance Bun.js backend to provide end-to-end emergency response capabilities — from SOS reporting and AI-powered triage to volunteer dispatch and crowd-sourced danger mapping.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [System Design Decisions](#system-design-decisions)
4. [Core Features](#core-features)
5. [Technology Stack](#technology-stack)
6. [Project Structure](#project-structure)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Real-Time Communication](#real-time-communication)
10. [Event-Driven Architecture](#event-driven-architecture)
11. [Scalability and Fault Tolerance](#scalability-and-fault-tolerance)
12. [Getting Started](#getting-started)
13. [Deployment](#deployment)
14. [Environment Variables](#environment-variables)

---

## Overview

RakshaSetu addresses the critical gap in disaster response by providing a unified platform that connects citizens in distress with nearby volunteers, first responders, and relief resources. The system is designed for high-availability scenarios where traditional communication infrastructure may be compromised.

### Key Capabilities

- Real-time SOS reporting with AI-driven severity scoring and multilingual translation
- Automated volunteer dispatch based on geospatial proximity
- Live incident tracking with geospatial clustering
- Early Warning System integrating USGS earthquake data and OpenWeatherMap severe weather alerts
- Geofence-based danger zone alerts for citizens approaching active incidents
- Offline-capable BLE mesh relay for SOS broadcast without internet
- AI-powered chatbot for emergency guidance and first aid instructions
- Voice-based SOS using AWS Transcribe and Polly for speech-to-text and text-to-speech

---

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Mobile Application"
        A["Citizen App (React Native / Expo)"]
    end

    subgraph "Backend Services"
        B["Express API Server"]
        C["WebSocket Server"]
        D["Kafka Message Broker"]
    end

    subgraph "Workers"
        E["Alert Targeting Worker"]
        F["Dispatch Worker"]
        G["Outbox Processor"]
    end

    subgraph "External Services"
        H["AWS RDS PostgreSQL + PostGIS"]
        I["Redis (Rate Limiting + Cache)"]
        J["OpenAI GPT (AI Triage)"]
        K["AWS Transcribe / Polly"]
        L["Cloudflare R2 (Media Storage)"]
        M["Expo Push Notification Service"]
        N["USGS / OpenWeatherMap APIs"]
    end

    A <-->|REST + WebSocket| B
    A <-->|Real-time Events| C
    B --> D
    D --> E
    D --> F
    B --> G
    B --> H
    B --> I
    B --> J
    B --> K
    B --> L
    E --> M
    F --> M
    F --> C
    G --> C
    B --> N
```

### SOS-to-Dispatch Flow

```mermaid
sequenceDiagram
    participant V as Victim
    participant API as Express API
    participant AI as OpenAI GPT
    participant DB as PostgreSQL
    participant K as Kafka
    participant DW as Dispatch Worker
    participant WS as WebSocket
    participant Vol as Volunteer App

    V->>API: POST /api/v1/sos (category, description, location)
    API->>AI: Translate + score severity
    AI-->>API: Severity score, translated description
    API->>DB: Create SOS Report
    API->>DB: Find or create Incident (geo-clustering)
    API->>K: Produce DISPATCH_REQUEST event
    API-->>V: 201 Created (reportId)

    K->>DW: Consume DISPATCH_REQUEST
    DW->>DB: ST_DWithin query (find volunteers within 2km)
    DW->>WS: Send VOLUNTEER_DISPATCH to each volunteer
    DW->>Vol: Push Notification (via Expo)
    WS-->>Vol: Real-time pop-up alert

    Vol->>API: POST /api/v1/dispatch/accept
    API->>WS: Broadcast DISPATCH_ACCEPTED to victim
    WS-->>V: Responder location on map
```

### Early Warning System Flow

```mermaid
sequenceDiagram
    participant USGS as USGS / OpenWeatherMap
    participant EWS as EWS Polling Service
    participant DB as PostgreSQL
    participant K as Kafka
    participant AW as Alert Targeting Worker
    participant WS as WebSocket
    participant App as Citizen App

    EWS->>USGS: Poll for severe events (every 10-15 min)
    USGS-->>EWS: Earthquake / weather data
    EWS->>DB: Store NaturalDisasterAlert
    EWS->>K: Produce NATURAL_DISASTER_ALERT

    K->>AW: Consume alert event
    AW->>DB: Find users within affected region
    AW->>WS: Broadcast EMERGENCY_ALERT to nearby users
    AW->>App: Push Notification

    WS-->>App: Real-time Red Alert Modal
```

### Geofence Alerts Flow

```mermaid
flowchart LR
    A["App Startup"] --> B["Fetch Active Incidents via API"]
    B --> C["Convert to LocationRegions (1km radius)"]
    C --> D["expo-location startGeofencingAsync"]
    D --> E{"User enters danger zone?"}
    E -->|Yes| F["Trigger EMERGENCY_ALERT locally"]
    F --> G["Display Red Alert Modal"]
    E -->|No| H["Continue monitoring"]
```

---

## System Design Decisions

### Why Apache Kafka

Disaster management systems experience extreme traffic spikes. When an earthquake hits, thousands of SOS reports arrive simultaneously. A synchronous architecture would collapse under this load — the API server would block on volunteer search queries, push notification delivery, and alert targeting while the victim waits for a response.

Kafka solves this by decoupling the SOS submission from all downstream processing:

```mermaid
flowchart LR
    subgraph "Synchronous Path (fast)"
        A["POST /sos"] --> B["Save to DB"]
        B --> C["Return 201 to victim"]
    end

    subgraph "Asynchronous Path (via Kafka)"
        B --> D["Produce DISPATCH_REQUEST"]
        D --> E["Dispatch Worker"]
        E --> F["Find volunteers via PostGIS"]
        F --> G["Send push notifications"]
        F --> H["Send WebSocket alerts"]
    end
```

**Design rationale:**

- **Durability**: Kafka persists messages to disk. If the dispatch worker crashes mid-processing, the message is replayed from the committed offset on restart. No SOS is ever lost.
- **Backpressure handling**: During a mass-casualty event, the producer can write thousands of events per second. Consumers process them at their own pace without overwhelming the database.
- **Consumer group scaling**: Multiple dispatch worker instances can share the same consumer group. Kafka automatically partitions the load across them.
- **Topic isolation**: `DISPATCH_REQUEST` and `NATURAL_DISASTER_ALERT` are separate topics with independent consumers, so a slow alert pipeline never blocks volunteer dispatch.

The system uses KRaft mode (no Zookeeper dependency), reducing operational complexity from three processes to one.

### Why Redis

Redis serves two distinct roles in the architecture, each chosen for specific performance characteristics:

**1. Rate Limiting (Token Bucket via `rate-limit-redis`)**

During emergencies, the API faces both legitimate traffic spikes and potential abuse. Redis-backed rate limiting provides:

- **Distributed state**: If the backend scales to multiple instances behind a load balancer, all instances share the same rate limit counters through Redis. An in-memory store would reset on each instance, allowing clients to exceed limits by hitting different servers.
- **Atomic operations**: Redis `INCR` and `EXPIRE` are atomic, eliminating race conditions that would occur with database-backed counters.
- **Sub-millisecond latency**: Rate limit checks run on every API request. Redis responds in under 1ms, adding negligible overhead compared to the 50-200ms a PostgreSQL round trip would require.

**2. Caching Layer**

Frequently accessed data such as incident lists and user profiles are cached in Redis with TTL-based expiration, reducing database load during high-traffic periods:

```
Request → Check Redis Cache → Hit? → Return cached response
                             → Miss? → Query PostgreSQL → Store in Redis → Return
```

### Why PostgreSQL with PostGIS

The core operations of disaster management are inherently geospatial: finding nearby volunteers, clustering SOS reports into incidents, identifying users within an earthquake's radius, and locating relief centers. PostGIS extends PostgreSQL with spatial indexing and geographic functions that make these operations efficient:

**Volunteer proximity search:**
```sql
SELECT id FROM "User"
WHERE "isVolunteer" = true
  AND "lastLocationGeo" IS NOT NULL
  AND ST_DWithin(
    "lastLocationGeo",
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    2000  -- 2km radius
  )
LIMIT 5;
```

This query uses a GiST spatial index to find volunteers within 2km in under 5ms, regardless of how many users exist in the system. A naive approach using the Haversine formula on raw latitude/longitude columns would require a full table scan.

**Incident clustering** uses similar spatial queries to group SOS reports within a configurable radius into unified incidents, preventing duplicate incident creation when multiple people report the same event.

**Why not a dedicated geospatial database (e.g., MongoDB with GeoJSON)?** PostgreSQL with PostGIS provides the same geospatial capabilities while maintaining ACID transactions, relational integrity, and compatibility with Prisma ORM. The application needs transactional guarantees (e.g., creating an SOS report and its outbox entry atomically) that document databases cannot reliably provide.

### Why WebSockets over Server-Sent Events or Polling

The application requires bidirectional real-time communication:

- **Server to client**: Dispatch alerts, EWS warnings, incident updates, responder location tracking
- **Client to server**: Volunteer location broadcasting during active dispatch

Server-Sent Events (SSE) only support server-to-client streaming. Long polling introduces latency and wastes bandwidth. WebSockets provide a persistent, low-latency, full-duplex channel that handles both directions over a single TCP connection.

The implementation maintains a map of authenticated user IDs to WebSocket connections, enabling targeted message delivery:

```
sendToUser(userId, { type: "VOLUNTEER_DISPATCH", payload: { ... } })
```

This allows the dispatch worker to send alerts only to specific volunteers rather than broadcasting to all connected clients.

### Design Patterns

#### Transactional Outbox Pattern

```mermaid
flowchart TD
    A["API Handler"] --> B["BEGIN Transaction"]
    B --> C["INSERT SosReport"]
    C --> D["INSERT OutboxEvent"]
    D --> E["COMMIT Transaction"]
    E --> F["Background Poller (5s interval)"]
    F --> G["SELECT unpublished events"]
    G --> H["Broadcast via WebSocket"]
    H --> I["UPDATE status = PUBLISHED"]
```

The outbox pattern guarantees that every database mutation produces a corresponding event, even if Kafka or WebSocket delivery temporarily fails. This eliminates the dual-write problem where a database write succeeds but the event publish fails, leaving the system in an inconsistent state.

#### Event-Driven Architecture with Consumer Workers

Instead of processing everything in the API request cycle, the system delegates expensive operations to dedicated Kafka consumer workers:

| Worker | Trigger | Responsibility |
|--------|---------|----------------|
| Dispatch Worker | `DISPATCH_REQUEST` topic | PostGIS volunteer search, push notification delivery, WebSocket dispatch |
| Alert Targeting Worker | `NATURAL_DISASTER_ALERT` topic | Find affected users by geography, send targeted alerts |
| Outbox Processor | Timer (5s polling) | Publish pending database events to WebSocket clients |

This separation ensures the API response time remains fast (under 500ms) regardless of how many downstream systems need to be notified.

#### Request Lifecycle

```mermaid
flowchart TD
    A["Mobile App"] -->|HTTPS| B["Express API"]
    B --> C{"Rate Limiter (Redis)"}
    C -->|Over limit| D["429 Too Many Requests"]
    C -->|Allowed| E["JWT Authentication"]
    E -->|Invalid| F["401 Unauthorized"]
    E -->|Valid| G["Zod Schema Validation"]
    G -->|Invalid| H["400 Bad Request"]
    G -->|Valid| I["Service Layer"]
    I --> J["Repository Layer"]
    J --> K["PostgreSQL + PostGIS"]
    I --> L["Kafka Producer"]
    L --> M["Consumer Workers"]
    M --> N["WebSocket / Push Notification"]
    I -->|Response| B
    B -->|JSON| A
```

---

## Core Features

### 1. SOS Reporting and AI Triage

Citizens can report emergencies through a dedicated SOS screen supporting multiple categories: Flood, Fire, Earthquake, Accident, Medical, Violence, Landslide, Cyclone, and Other. Each report is processed through the following pipeline:

- **AI Translation**: Descriptions in any language are translated to English using OpenAI GPT
- **Severity Scoring**: AI assigns a 1-10 severity score to prioritize response
- **Incident Clustering**: Reports within geographic proximity are automatically grouped into unified incidents using PostGIS spatial queries
- **Media Attachments**: Users can attach images, video, and audio evidence stored on Cloudflare R2

### 2. Volunteer Dispatch System

The dispatch system connects victims with nearby qualified volunteers:

- **Volunteer Registration**: Users opt-in via a toggle in Settings, optionally declaring skills (CPR, Medical Doctor, Firefighter, Search and Rescue, etc.)
- **Proximity Search**: PostGIS `ST_DWithin` queries find active volunteers within a configurable radius (default 2km)
- **Dual Notification**: Volunteers receive both a push notification and a real-time WebSocket alert
- **Accept/Decline Flow**: Volunteers review the request and accept or decline; acceptance triggers real-time location sharing with the victim
- **Live Tracking**: The victim sees the volunteer's location updating on a map in real time

### 3. Early Warning System (EWS)

The platform continuously monitors external data sources for natural disasters:

- **USGS Earthquake Feed**: Polls the USGS API every 10 minutes for seismic events
- **OpenWeatherMap Severe Weather**: Polls every 15 minutes for storms, floods, and extreme weather
- **Targeted Alerts**: Only users within the affected geographic region receive alerts
- **Red Alert Modal**: A full-screen, high-urgency modal with disaster type, location, and severity

### 4. Geofence Danger Zone Alerts

The app sets up invisible geofences around active incidents:

- On app startup, all `OPEN` incidents are fetched from the backend
- Each incident becomes a 1km-radius geofence monitored by `expo-location`
- When a user physically enters a danger zone, a warning alert is triggered automatically
- Works in the background even when the app is not in the foreground

### 5. AI Emergency Chatbot

An integrated conversational AI assistant powered by OpenAI provides:

- Emergency guidance and first aid instructions
- Information about nearby relief centers and hospitals
- Voice input support via AWS Transcribe (speech-to-text)
- Voice response via AWS Polly (text-to-speech)

### 6. Real-Time Incident Map

The Explore tab provides a geospatial overview of the current situation:

- Active incidents displayed as color-coded markers by category
- Relief centers (shelters, hospitals, food centers) with real-time capacity
- Volunteer responder location tracking after dispatch acceptance
- Automated relief center discovery via integrated search APIs

### 7. Community and Social Features

- Community feed for sharing situation reports and mutual aid requests
- Upvote/downvote system for report credibility
- Real-time WebSocket updates for new incidents and status changes

### 8. BLE Mesh Relay (Offline SOS)

For scenarios with no internet connectivity:

- BLE (Bluetooth Low Energy) beacon broadcasting of SOS signals
- Passive mesh scanning detects nearby SOS beacons
- Relay mechanism propagates alerts through a chain of devices
- Enables emergency communication in network-dead zones

### 9. Voice-Based SOS

- Speech-to-text transcription using AWS Transcribe Streaming
- Text-to-speech responses using AWS Polly
- Enables hands-free emergency reporting for injured or visually impaired users

### 10. Offline Data Synchronization

- Local data bootstrapping for critical information
- WatermelonDB integration for offline-first data persistence
- Automatic sync when connectivity is restored

---

## Technology Stack

### Mobile Application

| Technology | Purpose |
|---|---|
| React Native (Expo SDK 54) | Cross-platform mobile framework |
| Expo Router | File-based navigation |
| React Native Maps | Geospatial visualization |
| expo-location | GPS, background tracking, geofencing |
| expo-notifications | Push notifications |
| expo-task-manager | Background task execution |
| expo-av | Audio recording and playback |
| react-native-ble-plx | BLE mesh relay |
| WatermelonDB | Offline-first database |

### Backend

| Technology | Purpose |
|---|---|
| Bun | JavaScript runtime |
| Express 5 | HTTP framework |
| Prisma 7 | ORM with PostgreSQL adapter |
| PostgreSQL + PostGIS | Relational database with geospatial extensions |
| Apache Kafka (KRaft) | Event streaming and async processing |
| Redis | Rate limiting and caching |
| WebSocket (ws) | Real-time bidirectional communication |
| Zod | Runtime schema validation |

### Cloud Services

| Service | Purpose |
|---|---|
| AWS RDS (PostgreSQL + PostGIS) | Managed relational database with geospatial extensions |
| AWS ECS (Fargate) | Serverless container orchestration for backend and Kafka |
| AWS ECR | Private Docker image registry |
| AWS ALB | Application Load Balancer for stable endpoint and HTTPS termination |
| RedisLabs | Managed Redis for rate limiting and caching |
| Cloudflare R2 | Object storage for media uploads |
| AWS Transcribe | Speech-to-text |
| AWS Polly | Text-to-speech |
| OpenAI GPT | AI triage, translation, chatbot |
| Expo Push Service | Mobile push notifications |
| USGS API | Earthquake data |
| OpenWeatherMap | Severe weather alerts |

---

## Project Structure

```
RakshaSetu/
├── docker-compose.yml          # Kafka + Backend containerization
├── Dockerfile                  # Multi-stage Bun production build
├── prisma/
│   ├── schema.prisma           # Database schema (14 models)
│   ├── migrations/             # SQL migration history
│   └── generated/              # Generated Prisma client
├── prisma.config.ts            # Prisma configuration
├── packages/
│   ├── kafka/                  # Shared Kafka library
│   │   └── src/
│   │       ├── index.ts        # Producer, consumer, topic exports
│   │       ├── config.ts       # Kafka broker configuration
│   │       ├── producer.ts     # Message producer
│   │       ├── consumer.ts     # Consumer group runner
│   │       └── topics.ts       # Topic name constants
│   ├── user-be/                # Backend API server
│   │   └── src/
│   │       ├── index.ts        # Server entry point
│   │       ├── config/         # Environment configuration
│   │       ├── common/         # Shared middleware, DB clients
│   │       ├── routes/         # Express route definitions
│   │       ├── modules/
│   │       │   ├── auth/       # JWT authentication
│   │       │   ├── users/      # User profile management
│   │       │   ├── sos/        # SOS report submission
│   │       │   ├── incidents/  # Incident CRUD and clustering
│   │       │   ├── dispatch/   # Volunteer dispatch worker
│   │       │   ├── assignments/# Responder task assignments
│   │       │   ├── teams/      # Response team management
│   │       │   ├── alerts/     # EWS disaster ingestion
│   │       │   ├── chat/       # AI chatbot + voice
│   │       │   ├── relief-centers/ # Relief center management
│   │       │   ├── timeline/   # Incident timeline events
│   │       │   └── outbox/     # Transactional outbox pattern
│   │       └── ws/             # WebSocket server and handlers
│   └── citizen-app/            # React Native mobile app
│       ├── app/
│       │   ├── _layout.tsx     # Root layout (EWS + dispatch listeners)
│       │   ├── (tabs)/
│       │   │   ├── index.tsx       # Home (incident feed)
│       │   │   ├── sos.tsx         # SOS reporting screen
│       │   │   ├── explore.tsx     # Map with incidents + relief centers
│       │   │   ├── danger-zones.tsx# Live danger zone map
│       │   │   ├── community.tsx   # Social feed
│       │   │   ├── chatbot.tsx     # AI assistant
│       │   │   ├── my-reports.tsx  # User's SOS history
│       │   │   └── settings.tsx    # Profile + volunteer toggle
│       │   ├── dispatch-request.tsx # Volunteer accept/decline screen
│       │   └── incident/[id].tsx   # Incident detail view
│       ├── components/
│       │   └── alerts/
│       │       └── RedAlertModal.tsx # Full-screen EWS warning
│       └── services/
│           ├── api.ts              # REST API client
│           ├── socket.ts           # WebSocket client
│           ├── auth-store.ts       # Secure token storage
│           ├── location-background.ts # GPS + geofencing
│           └── ble-mesh/           # BLE offline relay
```

---

## Database Schema

```mermaid
erDiagram
    User ||--o{ SosReport : submits
    User ||--o{ Assignment : receives
    User ||--o{ TeamMembers : belongs_to
    SosReport ||--o{ SosMedia : has
    SosReport }o--|| Incident : linked_to
    Incident ||--o{ Assignment : has
    Incident ||--o{ IncidentTimeline : tracks
    Incident ||--o{ IncidentMedia : has
    Team ||--o{ TeamMembers : contains
    Team ||--o{ Assignment : assigned_to
    NaturalDisasterAlert |o--o| Incident : may_create
    ReliefCenter |o--o| Incident : near

    User {
        uuid id PK
        string email
        string phone
        string fullName
        enum role
        boolean isVolunteer
        enum skills
        geography lastLocationGeo
        string pushToken
    }

    SosReport {
        uuid id PK
        uuid userId FK
        enum category
        string description
        decimal latitude
        decimal longitude
        int severity
        enum status
    }

    Incident {
        uuid id PK
        string title
        enum category
        enum status
        enum priority
        decimal centroidLat
        decimal centroidLng
        int reportCount
    }

    Assignment {
        uuid id PK
        uuid incidentId FK
        uuid userId FK
        enum status
        string notes
    }

    ReliefCenter {
        uuid id PK
        string name
        enum type
        enum status
        int maxCapacity
        int currentCount
        decimal latitude
        decimal longitude
    }

    NaturalDisasterAlert {
        uuid id PK
        string externalId
        string alertType
        string severity
        string title
        geography affectedArea
    }
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Register a new citizen account |
| POST | `/api/v1/auth/login` | Authenticate and receive JWT |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/me` | Get current user profile |
| PATCH | `/api/v1/users/me` | Update profile, volunteer status, location |

### SOS Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sos` | Submit an SOS report |
| GET | `/api/v1/sos/my` | List current user's reports |
| POST | `/api/v1/sos/:id/media` | Upload media attachment |

### Incidents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/incidents` | List incidents (paginated, filterable) |
| GET | `/api/v1/incidents/:id` | Get incident details |
| GET | `/api/v1/incidents/nearby` | Find incidents near a location |
| GET | `/api/v1/incidents/:id/media` | Get incident media |
| GET | `/api/v1/incidents/:id/timeline` | Get incident timeline |

### Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/assignments` | Create responder assignment |
| GET | `/api/v1/assignments/my` | List user's assignments |
| PATCH | `/api/v1/assignments/:id/status` | Update assignment status |

### Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/teams` | Create a response team |
| GET | `/api/v1/teams` | List teams |
| POST | `/api/v1/teams/:id/members` | Add member to team |
| DELETE | `/api/v1/teams/:id/members/:userId` | Remove member |

### Relief Centers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/relief-centers/nearby` | Find nearby relief centers |
| GET | `/api/v1/relief-centers/:id` | Get relief center details |
| POST | `/api/v1/relief-centers/fetch-automated` | Discover centers via external APIs |

### AI Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat` | Send text message to AI assistant |
| POST | `/api/v1/chat/audio` | Send audio for voice-based interaction |

---

## Real-Time Communication

### WebSocket Events

The platform uses WebSocket connections for real-time bidirectional communication between the backend and mobile clients.

**Server to Client Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `incident:update` | `{ incidentId, status, category }` | Incident status change |
| `incident:new` | Incident object | New incident created |
| `EMERGENCY_ALERT` | `{ type, location, severity }` | EWS disaster warning |
| `NATURAL_DISASTER` | Alert payload | Natural disaster notification |
| `VOLUNTEER_DISPATCH` | `{ incidentId, category, lat, lng }` | Dispatch request to volunteer |
| `DISPATCH_ACCEPTED` | `{ responderId, lat, lng }` | Volunteer accepted dispatch |
| `location:update` | `{ lat, lng, speed, heading }` | Responder location update |
| `emergency:proximity` | `{ incidentId, message }` | Nearby emergency alert |
| `relief-center:update` | `{ id, status, currentCount }` | Relief center capacity change |
| `outbox:IncidentCreated` | Incident data | Outbox event broadcast |
| `outbox:NaturalDisasterAlert` | Alert data | Outbox disaster alert |

**Client to Server Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `location:update` | `{ lat, lng, speed, heading }` | User location broadcast |

---

## Event-Driven Architecture

### Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `NATURAL_DISASTER_ALERT` | EWS Ingestion | Alert Targeting Worker | Route disaster alerts to affected users |
| `DISPATCH_REQUEST` | SOS Service | Dispatch Worker | Find and notify nearby volunteers |

### Transactional Outbox Pattern

The system implements the transactional outbox pattern to ensure reliable event delivery:

1. Database changes and outbox entries are written in the same transaction
2. A background poller reads unpublished outbox entries every 5 seconds
3. Events are broadcast via WebSocket and marked as published
4. This guarantees at-least-once delivery even if Kafka is temporarily unavailable

---

## Scalability and Fault Tolerance

### Horizontal Scaling Strategy

```mermaid
graph LR
    subgraph "Load Balancer"
        LB["AWS ALB"]
    end

    subgraph "API Instances"
        A1["user-be Instance 1"]
        A2["user-be Instance 2"]
        A3["user-be Instance N"]
    end

    subgraph "Shared State"
        R["Redis (rate limits + sessions)"]
        K["Kafka (event bus)"]
        DB["PostgreSQL + PostGIS"]
    end

    LB --> A1
    LB --> A2
    LB --> A3
    A1 --> R
    A2 --> R
    A3 --> R
    A1 --> K
    A2 --> K
    A3 --> K
    A1 --> DB
    A2 --> DB
    A3 --> DB
```

The architecture is designed for horizontal scaling at every layer:

| Component | Scaling Mechanism |
|-----------|-------------------|
| API Server | Add instances behind a load balancer; no shared in-process state |
| Kafka Consumers | Add instances to the same consumer group; Kafka redistributes partitions automatically |
| PostgreSQL | AWS RDS provides read replicas and Multi-AZ failover; PostGIS indexes remain effective at scale |
| Redis | RedisLabs provides clustering and automatic sharding |
| WebSocket | Sticky sessions via load balancer; future option to use Redis pub/sub for cross-instance message routing |

### Graceful Degradation

The system is designed to remain functional when individual components fail:

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Kafka unavailable | Async dispatch stops | Outbox pattern continues to capture events; they are replayed when Kafka recovers |
| Redis unavailable | Rate limiting falls back to in-memory | API continues serving requests; rate limits may be less accurate across instances |
| OpenAI API timeout | AI triage slows down | SOS reports are still saved with default severity; manual triage can proceed |
| Push notification failure | Volunteers miss push alerts | WebSocket dispatch provides a parallel notification channel |
| Internet connectivity loss | Mobile app goes offline | BLE mesh relay enables SOS broadcasting between nearby devices |

### Offline Resilience

The mobile application is designed with offline-first principles:

1. **BLE Mesh Relay**: When internet is unavailable, the app broadcasts SOS signals via Bluetooth Low Energy. Nearby devices with connectivity relay the signal to the backend.
2. **Local Data Bootstrap**: Critical reference data (relief center locations, emergency numbers) is cached locally on app startup.
3. **WatermelonDB**: Provides an offline-capable SQLite-based database that syncs with the backend when connectivity is restored.

### Capacity Planning

Estimated throughput for a single `t3.medium` EC2 instance (2 vCPU, 4GB RAM):

| Operation | Sustained Throughput |
|-----------|---------------------|
| API requests (REST) | ~500 requests/sec |
| WebSocket connections | ~5,000 concurrent |
| Kafka event production | ~10,000 events/sec |
| PostGIS spatial queries | ~2,000 queries/sec |

For a city-scale deployment (1 million users), the recommended configuration is 3 API instances, 2 Kafka consumer instances, and a managed PostgreSQL instance with 4 vCPU.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) v18+ (for Expo CLI)
- A PostgreSQL database with PostGIS enabled (AWS RDS or local)
- A Redis instance (local or managed)

### 1. Clone the Repository

```bash
git clone https://github.com/neutron420/RakshaSetu.git
cd RakshaSetu
```

### 2. Start Kafka

```bash
docker compose up kafka -d
```

### 3. Configure Environment Variables

```bash
cp packages/user-be/.env.example packages/user-be/.env
# Edit .env with your actual values (see Environment Variables section)
```

### 4. Install Dependencies and Generate Prisma Client

```bash
bun install
bunx prisma generate --config prisma.config.ts
bunx prisma migrate deploy --config prisma.config.ts
```

### 5. Start the Backend

```bash
cd packages/user-be
bun run src/index.ts
```

The API server will be available at `http://localhost:5001`.

### 6. Start the Mobile Application

```bash
cd packages/citizen-app
npm install
npx expo start --tunnel
```

Scan the QR code with the Expo Go app or a development build.

### 7. Build a Development APK (Recommended)

```bash
cd packages/citizen-app
npx eas build --platform android --profile development
```

---

## Deployment

### Infrastructure Overview

The production deployment runs on AWS with the following architecture:

```
                        Internet
                           |
                    [AWS ALB - Port 80/443]
                           |
                    [ECS Fargate Cluster]
                     /              \
              [user-be:5001]   [kafka:9092]
                     |
            ---------+---------
            |                 |
    [AWS RDS PostgreSQL]  [Redis Cloud]
       (PostGIS)
```

| Component | AWS Service | Details |
|-----------|-------------|---------|
| Backend API | ECS Fargate | Bun.js server on port 5001 |
| Kafka Broker | ECS Fargate | KRaft mode, same task as backend |
| Database | RDS PostgreSQL | PostGIS enabled, ap-south-1 |
| Load Balancer | ALB | HTTP/HTTPS traffic distribution |
| Container Registry | ECR | Private Docker image storage |
| Cache / Rate Limiter | Redis Cloud | External managed Redis |

### Prerequisites

- AWS CLI configured with appropriate credentials
- Docker installed locally
- An AWS account with access to ECR, ECS, RDS, and EC2

---

### Step 1: Set Up RDS PostgreSQL with PostGIS

#### 1.1 Create the RDS Instance

1. Navigate to **AWS Console > RDS > Create database**
2. Select **PostgreSQL** as the engine
3. Choose the appropriate instance class (e.g., `db.t3.micro` for development)
4. Configure the following:
   - DB instance identifier: `rakshasetu-db`
   - Master username: `postgres`
   - Set a secure master password
   - VPC: Use the default VPC or create a dedicated one
   - Public access: Yes (for initial setup; restrict later)
5. Under **Additional configuration**, set the initial database name to `postgres`
6. Click **Create database**

#### 1.2 Configure the Security Group

1. Navigate to **RDS > Databases > rakshasetu-db > Connectivity & security**
2. Click the VPC security group link
3. Add an inbound rule:
   - Type: PostgreSQL (5432)
   - Source: Your IP address for local access, and the ECS security group for production

#### 1.3 Enable PostGIS Extension

PostGIS is required for geographic data types and spatial queries. Enable it by running:

```bash
cd packages/user-be
bun run scripts/enable-postgis.ts
```

Or connect directly and execute:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### 1.4 Push the Database Schema

```bash
# From the project root
bunx prisma db push
```

#### 1.5 Verify the Schema

Open Prisma Studio to browse the tables:

```bash
bunx prisma studio
```

Alternatively, connect using pgAdmin:
1. Download and install pgAdmin from https://www.pgadmin.org
2. Register a new server with the RDS endpoint
3. Set SSL mode to **Require** in the SSL tab
4. Browse **Schemas > public > Tables** to verify all tables exist

**Important**: The `DATABASE_URL` must include `?sslmode=require` for RDS connections:

```
DATABASE_URL="postgresql://postgres:<password>@<rds-endpoint>:5432/postgres?sslmode=require"
```

---

### Step 2: Create an ECR Repository

ECR stores the Docker image that ECS will pull from.

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Create the repository
aws ecr create-repository --repository-name rakshasetu-backend --region ap-south-1
```

---

### Step 3: Build and Push the Docker Image

The root Dockerfile uses a multi-stage build that includes both the Kafka package and the backend:

```bash
# Build the image
docker build -t rakshasetu-backend .

# Tag for ECR
docker tag rakshasetu-backend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rakshasetu-backend:latest

# Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rakshasetu-backend:latest
```

The Dockerfile structure:

```
Stage 1 (deps)    - Install dependencies with bun install --frozen-lockfile
Stage 2 (builder) - Copy source code and generate Prisma client
Stage 3 (runner)  - Slim production image with only runtime artifacts
```

---

### Step 4: Create an ECS Cluster

1. Navigate to **AWS Console > ECS > Clusters > Create Cluster**
2. Configure:
   - Cluster name: `rakshasetu-cluster`
   - Infrastructure: **AWS Fargate**
3. Click **Create**

---

### Step 5: Create the Task Definition

The task definition defines two containers running in the same Fargate task. Containers within the same task share `localhost`, so the backend reaches Kafka at `localhost:9092`.

1. Navigate to **ECS > Task Definitions > Create new task definition**
2. Configure the task:
   - Family: `rakshasetu-task`
   - Launch type: **AWS Fargate**
   - CPU: `2 vCPU`
   - Memory: `4 GB`
   - Task execution role: `ecsTaskExecutionRole`

#### Container 1: Kafka

| Setting | Value |
|---------|-------|
| Name | `kafka` |
| Image | `apache/kafka:latest` |
| Essential | Yes |
| Port | `9092` (TCP) |

Environment variables:

| Key | Value |
|-----|-------|
| `KAFKA_NODE_ID` | `1` |
| `KAFKA_PROCESS_ROLES` | `broker,controller` |
| `KAFKA_LISTENERS` | `PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093` |
| `KAFKA_ADVERTISED_LISTENERS` | `PLAINTEXT://localhost:9092` |
| `KAFKA_CONTROLLER_LISTENER_NAMES` | `CONTROLLER` |
| `KAFKA_INTER_BROKER_LISTENER_NAME` | `PLAINTEXT` |
| `KAFKA_CONTROLLER_QUORUM_VOTERS` | `1@localhost:9093` |
| `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR` | `1` |
| `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR` | `1` |
| `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR` | `1` |
| `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS` | `0` |
| `KAFKA_LOG_DIRS` | `/tmp/kraft-combined-logs` |

#### Container 2: user-be

| Setting | Value |
|---------|-------|
| Name | `user-be` |
| Image | `<ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rakshasetu-backend:latest` |
| Essential | Yes |
| Port | `5001` (TCP, HTTP) |
| Startup dependency | Kafka container (condition: START) |

Environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `USER_BE_PORT` | `5001` |
| `KAFKA_BROKERS` | `localhost:9092` |
| `KAFKA_ENABLED` | `true` |
| `KAFKA_CLIENT_ID` | `rakshasetu` |
| `DATABASE_URL` | `postgresql://postgres:<password>@<rds-endpoint>:5432/postgres?sslmode=require` |
| `JWT_SECRET` | Your JWT secret |
| `JWT_EXPIRES_IN` | `7d` |
| `REDIS_URL` | Your Redis connection string |
| `R2_ENDPOINT` | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | `rakshasetu` |
| `R2_PUBLIC_DOMAIN` | R2 public domain |

---

### Step 6: Set Up the Application Load Balancer (ALB)

An ALB provides a stable DNS endpoint that does not change when ECS tasks restart. Without an ALB, the public IP assigned to a Fargate task changes on every deployment or task restart.

#### 6.1 Create a Target Group

1. Navigate to **EC2 > Target Groups > Create target group**
2. Configure:
   - Target type: **IP addresses** (required for Fargate)
   - Name: `rakshasetu-tg`
   - Protocol: HTTP
   - Port: `5001`
   - VPC: Same VPC as the RDS instance
   - Health check path: `/health`
   - Health check protocol: HTTP
3. Click **Create** (do not register targets manually; ECS handles this)

#### 6.2 Create the Load Balancer

1. Navigate to **EC2 > Load Balancers > Create Load Balancer > Application Load Balancer**
2. Configure:
   - Name: `rakshasetu-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4
   - Network mapping: Select the same VPC as RDS with at least 2 subnets in different availability zones
   - Security group: Create a new security group (`rakshasetu-alb-sg`) with inbound rules:
     - HTTP (80) from `0.0.0.0/0`
     - HTTPS (443) from `0.0.0.0/0` (when SSL is configured)
   - Listener: HTTP on port 80, forward to `rakshasetu-tg`
3. Click **Create**

#### 6.3 Note the ALB DNS

After creation, the ALB provides a DNS name:

```
rakshasetu-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com
```

This is the stable endpoint for the API.

---

### Step 7: Create the ECS Service

1. Navigate to **ECS > Clusters > rakshasetu-cluster > Create Service**
2. Configure:
   - Launch type: **Fargate**
   - Task definition: `rakshasetu-task` (latest revision)
   - Service name: `rakshasetu-service`
   - Desired tasks: `1`
3. Networking:
   - VPC: Same as RDS
   - Subnets: Select public subnets
   - Security group: Create `rakshasetu-ecs-sg` with:
     - Inbound: TCP 5001 from the ALB security group (`rakshasetu-alb-sg`)
     - Outbound: All traffic
   - Auto-assign public IP: Enabled
4. Load balancing:
   - Type: Application Load Balancer
   - Load balancer: `rakshasetu-alb`
   - Container to load balance: `user-be:5001`
   - Target group: `rakshasetu-tg`
5. Click **Create**

---

### Step 8: Configure Security Groups

Three security groups are involved in the production setup:

| Security Group | Inbound Rules | Purpose |
|---------------|---------------|---------|
| `rakshasetu-alb-sg` | HTTP (80) from `0.0.0.0/0`, HTTPS (443) from `0.0.0.0/0` | ALB accepts public traffic |
| `rakshasetu-ecs-sg` | TCP 5001 from `rakshasetu-alb-sg` | ECS accepts traffic only from ALB |
| `rakshasetu-db-sg` | PostgreSQL (5432) from `rakshasetu-ecs-sg` | RDS accepts traffic only from ECS |

This creates a layered security model where:
- The internet can only reach the ALB
- The ALB can only reach ECS on port 5001
- ECS can only reach RDS on port 5432

---

### Step 9: Verify the Deployment

```bash
# Check the ALB endpoint
curl http://rakshasetu-alb-XXXXXXXXX.ap-south-1.elb.amazonaws.com/health

# Expected response:
# {"success":true,"service":"user-be","status":"ok","wsClients":0}
```

Monitor ECS task health:

```bash
# List running tasks
aws ecs list-tasks --cluster rakshasetu-cluster --region ap-south-1

# Describe task status
aws ecs describe-tasks \
  --cluster rakshasetu-cluster \
  --tasks <TASK_ARN> \
  --region ap-south-1 \
  --query "tasks[0].containers[*].{Name:name,Status:lastStatus,Health:healthStatus}" \
  --output table
```

View container logs in **ECS > Tasks > (select task) > Logs** tab, or via CloudWatch Logs if configured.

---

### Step 10: Adding HTTPS (Optional but Recommended)

1. Request a free SSL certificate from **AWS Certificate Manager (ACM)**
   - Navigate to ACM > Request a certificate
   - Enter your domain name (e.g., `api.rakshasetu.in`)
   - Validate via DNS
2. Add an HTTPS listener to the ALB:
   - Navigate to **EC2 > Load Balancers > rakshasetu-alb > Listeners**
   - Add listener: HTTPS (443), forward to `rakshasetu-tg`, select the ACM certificate
3. Redirect HTTP to HTTPS:
   - Edit the HTTP (80) listener to redirect to HTTPS (443)
4. Point your domain to the ALB using a CNAME or Route 53 alias record

---

### Updating the Deployment

When code changes are made, rebuild and push the Docker image:

```bash
# Build with a new tag
docker build -t rakshasetu-backend .
docker tag rakshasetu-backend:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rakshasetu-backend:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/rakshasetu-backend:latest

# Force ECS to pull the new image
aws ecs update-service \
  --cluster rakshasetu-cluster \
  --service rakshasetu-service \
  --force-new-deployment \
  --region ap-south-1
```

---

### Docker Compose (Local Development)

For local development, use Docker Compose to run Kafka and the backend together:

```bash
docker compose up --build -d
```

Verify:

```bash
curl http://localhost:5001/health
docker compose logs -f user-be
```

### Mobile App Distribution

- Development builds via EAS: `npx eas build --platform android --profile development`
- Production builds: `npx eas build --platform android --profile production`
- Internal distribution via EAS Update: `npx eas update`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `USER_BE_PORT` | Backend server port (default: 5001) |
| `DATABASE_URL` | PostgreSQL connection string (with PostGIS) |
| `JWT_SECRET` | Secret key for JWT token signing |
| `JWT_EXPIRES_IN` | Token expiration duration (e.g., `7d`) |
| `REDIS_URL` | Redis connection string |
| `KAFKA_ENABLED` | Enable Kafka event streaming (`true` / `false`) |
| `KAFKA_BROKERS` | Kafka broker addresses |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_DOMAIN` | R2 public CDN domain |
| `OPENAI_API_KEY` | OpenAI API key for AI triage and chatbot |
| `EXPO_ACCESS_TOKEN` | Expo push notification access token |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Transcribe/Polly |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (e.g., `ap-south-1`) |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID (SMS integration) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |

---

## License

This project is developed as part of an academic initiative. All rights reserved.
