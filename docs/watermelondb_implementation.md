# WatermelonDB Offline-First Implementation Guide

This guide outlines the architecture and implementation steps for integrating **WatermelonDB** into the `citizen-app`. 

This is the most critical survival feature in RakshaSetu: ensuring the Citizen App functions even when all cellular infrastructure has been destroyed and the user is 100% offline.

---

## 1. Why WatermelonDB?

During a disaster, network connectivity is the first thing to fail. If a citizen is fleeing a hazard zone and loses internet, standard apps instantly crash or show "Network Error", losing all map and safe zone data.

**The WatermelonDB Solution:**
To prevent this, we change the app to an **Offline-First** architecture.
- Instead of the React Native app reading from the Express API (`user-be`), the app *only reads from its own local SQLite database* (WatermelonDB).
- In the background, when the internet *is* available, WatermelonDB quietly connects to the backend and silently downloads the latest Incidents and Safe Zones.
- If the internet drops permanently, the Citizen App doesn't care. It continues reading the last synced data from the local SQLite file without interruption.

```mermaid
graph TD
    subgraph Offline Survival Zone (Citizen App)
        UI[React Native UI]
        WDB[(WatermelonDB Local SQLite)]
    end
    
    subgraph Cloud Infrastructure (Online Only)
        API[User-BE Express API]
        DB[(PostgreSQL)]
    end

    %% Flow
    UI -->|Reads instantly (0.001s)| WDB
    WDB -->|Background Sync (when online)| API
    API -->|Reads/Writes| DB
    
    classDef offline fill:#e8f5e9,stroke:#43a047
    classDef online fill:#e1f5fe,stroke:#039be5
    UI:::offline
    WDB:::offline
    API:::online
```

---

## 2. Step-by-Step Implementation Guide

Follow these steps tonight to implement WatermelonDB in the `citizen-app`.

### Step 1: Install Dependencies
Navigate into your Expo app (`packages/citizen-app`) and install the core packages:

```bash
cd packages/citizen-app
npx expo install @nozbe/watermelondb @nozbe/with-observables
```

*Note: WatermelonDB uses native modules (SQLite). If you aren't using Expo Dev Client, you will need to build an Expo prebuild/development build (`npx expo run:android` or `run:ios`) after this.*

### Step 2: Define the Schema
Create a file `packages/citizen-app/src/db/schema.ts` to define the shape of your local SQLite database.

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'incidents',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'type', type: 'string' }, // e.g., 'earthquake', 'fire'
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'relief_centers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'capacity', type: 'number', isOptional: true },
        { name: 'type', type: 'string' }, // 'hospital', 'shelter'
      ],
    }),
  ],
})
```

### Step 3: Create the Models
You need JavaScript classes to represent these tables. Create `src/db/models/Incident.ts`:

```typescript
import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export class Incident extends Model {
  static table = 'incidents'

  @field('title') title
  @field('description') description
  @field('latitude') latitude
  @field('longitude') longitude
  @field('type') type
  @date('created_at') createdAt
}
```

### Step 4: Initialize the Database
Create `packages/citizen-app/src/db/index.ts` to boot up the local SQLite connection when the app starts.

```typescript
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { mySchema } from './schema'
import { Incident } from './models/Incident'

const adapter = new SQLiteAdapter({
  schema: mySchema,
  // (You might need a JSI bridge depending on your Expo setup, but this is standard)
})

export const database = new Database({
  adapter,
  modelClasses: [
    Incident,
    // ReliefCenter
  ],
})
```

### Step 5: Implement the Sync Function
This is the magic. In `src/db/sync.ts`, you use WatermelonDB's built-in `synchronize()` function to automatically pull data from your Express API.

```typescript
import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'

export async function mySync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      // 1. Ask your 'user-be' API: "Give me everything that changed since lastPulledAt timestamp"
      const url = `https://your-api.com/sync?lastPulledAt=${lastPulledAt || 0}`
      const response = await fetch(url)
      
      const { changes, timestamp } = await response.json()
      
      // 2. WatermelonDB takes this JSON and writes it to SQLite instantly
      return { changes, timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // (Optional) Here, if the citizen created SOS alerts offline, 
      // WatermelonDB automatically detects internet and pushes them to your 'user-be'
    },
  })
}
```

---

## Impact on RakshaSetu

Once you write this:
1. When you open the Citizen App map, you don't use `fetch()`. You just read `database.get('incidents').query().fetch()`.
2. The UI renders in exactly 0.001 seconds because reading from local SQLite is instantaneous.
3. Your map heatmaps will work *flawlessly* miles deep into a collapsed tunnel or forest with zero cellular signal.
