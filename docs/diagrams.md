# RakshaSetu Architecture & Flow Diagrams

This document serves as a visual guide to understanding the functionality and data flow within the RakshaSetu platform. It contains High-Level Design (HLD) diagrams and specific Low-Level Design (LLD) workflows.

---

## 1. High-Level Design (HLD)
This diagram illustrates the macro-architecture of the entire system, showing how the frontend, backend, messaging queue, and external data sources interact.

```mermaid
graph TD
    %% Define styles
    classDef client fill:#e1f5fe,stroke:#039be5,stroke-width:2px;
    classDef backend fill:#fff3e0,stroke:#fb8c00,stroke-width:2px;
    classDef messaging fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef database fill:#e8f5e9,stroke:#43a047,stroke-width:2px;
    classDef external fill:#eceff1,stroke:#546e7a,stroke-width:2px;

    %% Nodes
    subgraph Client Tier
        CitizenApp["Citizen App (Expo/React Native)"]:::client
        subgraph Real-Time GIS
            MapboxVis["Mapbox Heatmaps & POIs"]:::client
            OfflineMaps["Offline BLE & Caching"]:::client
        end
        CitizenApp --> MapboxVis
        CitizenApp --> OfflineMaps
    end

    subgraph "Service Tier (Node.js/Express)"
        UserBE[User Backend API]:::backend
        WSServer[WebSocket Server]:::backend
        OutboxWorker[Transactional Outbox Worker]:::backend
    end

    subgraph Messaging Tier
        Kafka{"Apache Kafka Broker"}:::messaging
    end

    subgraph Data Tier
        DB[("PostgreSQL Database")]:::database
        Redis[("Redis Cache - Planned")]:::database
    end

    subgraph External Systems
        USGS["USGS Earthquake Data API"]:::external
        WeatherDev[Weather Alert APIs]:::external
        MapboxAPI["Mapbox Geocoding POI API"]:::external
    end

    %% Connections
    CitizenApp <-->|REST API| UserBE
    CitizenApp <-->|ws:// Real-time Updates| WSServer
    
    UserBE <-->|Read / Write| DB
    WSServer <-->|Session State| Redis
    
    UserBE -->|Atomically Writes Events| DB
    DB -.->|Polled by| OutboxWorker
    OutboxWorker -->|Produces Events| Kafka
    Kafka -->|Consumes Async Tasks| UserBE
    
    %% External Ingestions
    USGS -->|Cron Polling (EWS)| UserBE
    WeatherDev -->|Cron Polling (EWS)| UserBE
    UserBE -->|Fetches Hospitals/Shelters| MapboxAPI
    MapboxAPI -->|POI Data| UserBE
```

---

## 2. SOS Alert Flow (Low-Level Design)
This flow details exactly what happens when a citizen presses the SOS button on their device, ensuring the alert is reliably delivered even during poor network conditions.

```mermaid
sequenceDiagram
    participant Citizen as Citizen App
    participant BE as User Backend (REST/WS)
    participant DB as PostgreSQL (Outbox)
    participant Worker as Outbox Worker
    participant Kafka as Kafka (sos.reported)
    participant Assignment as Assignment Engine
    participant Team as Rescue Team App
    
    Citizen->>BE: POST /api/v1/sos (lat, lng, media)
    activate BE
    
    rect rgb(240, 248, 255)
        Note over BE,DB: Atomic Database Transaction
        BE->>DB: 1. Insert SOS Record
        BE->>DB: 2. Insert Outbox Event (Type: SOS_CREATED)
    end
    
    BE-->>Citizen: 201 Created (SOS ID)
    deactivate BE
    
    Citizen->>BE: Connect WebSocket (ws://)
    
    loop Every 5s
        Worker->>DB: Poll Pending Outbox Events
        DB-->>Worker: [SOS_CREATED Event]
        Worker->>Kafka: Publish to 'rakshasetu.sos.reported'
        Worker->>DB: Mark outbox event as 'PUBLISHED'
    end
    
    Kafka-->>Assignment: Consume 'sos.reported'
    activate Assignment
    Assignment->>DB: Find nearest available rescue teams
    Assignment->>DB: Create Assignment Record
    Assignment->>Worker: Trigger 'assignments.created' Event
    deactivate Assignment
    
    Worker->>Kafka: Publish 'assignments.created'
    Kafka-->>BE: Consume Assignment
    
    BE->>Team: WS Broadcast: New Assignment Alert!
    BE->>Citizen: WS Direct Msg: "Team Dispatching to your location"
```

---

## 3. Early Warning System (EWS) Disaster Ingestion Flow
This flow explains how RakshaSetu acts proactively, pulling data from global agencies and warning citizens before or during an active disaster (like an earthquake).

```mermaid
sequenceDiagram
    participant Cron as EWS Cron Scheduler
    participant External as USGS / Weather API
    participant BE as EWS Ingestion Service
    participant DB as PostgreSQL
    participant Kafka as Kafka (alerts.targeted)
    participant TargetWorker as Alert Targeting Worker
    participant Citizens as Citizen Devices (WebSockets/Push)

    loop Every 10-15 minutes
        Cron->>BE: Trigger pollDisasterEvents()
    end
    
    activate BE
    BE->>External: Fetch recent earthquakes/weather warnings
    External-->>BE: JSON FeatureCollection
    
    BE->>BE: Parse payload & filter minor events (Magnitude < 4.5)
    
    rect rgb(255, 240, 245)
        Note over BE,DB: For each critical disaster
        BE->>DB: Check if disaster already exists (deduplication)
        alt is New Event
            BE->>DB: Save Disaster Data (lat, lng, severity)
            BE->>Kafka: Publish 'rakshasetu.alerts.new_disaster'
        end
    end
    deactivate BE
    
    Kafka-->>TargetWorker: Consume 'new_disaster'
    activate TargetWorker
    TargetWorker->>DB: Query users within X km radius of disaster origin
    DB-->>TargetWorker: List of vulnerable User IDs
    TargetWorker->>DB: Queue Target Notifications
    deactivate TargetWorker
    
    TargetWorker->>Citizens: WS Broadcast / Expo Push Notifications ("🔴 RED ALERT: EARTHQUAKE DETECTED. SEEK COVER")
```

---

## 4. Offline BLE Mesh Relay Flow
When cellular infrastructure is completely destroyed, the Citizen app relies on Bluetooth Low Energy (BLE) to pass SOS packets hopper-style to a device that has an active internet connection.

```mermaid
graph LR
    subgraph "No Internet Zone"
        Victim1("Victim📱") -- BLE --> PeerA("Peer A📱")
        PeerA("Peer A📱") -- BLE --> PeerB("Peer B📱")
    end
    
    subgraph "Internet Connectivity Restored"
        PeerB -- Cellular/WiFi --> API("RakshaSetu Backend")
    end
    
    API --> DB[(DB)]
    API -.-> WS("WebSockets") -.-> Teams("Rescue Teams")
    
    style Victim1 fill:#ffcdd2,stroke:#d32f2f
    style PeerA fill:#fff9c4,stroke:#fbc02d
    style PeerB fill:#c8e6c9,stroke:#388e3c
    style API fill:#bbdefb,stroke:#1976d2
```
