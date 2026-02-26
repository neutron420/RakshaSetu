# ⚡ Managed Redis Implementation Guide for RakshaSetu

This document outlines the **Why**, **What**, and **How** of integrating a Managed Redis service (like Upstash) into the `user-be` package of RakshaSetu. 

By following this guide, we will protect the primary PostgreSQL database from collapsing under severe load during a disaster, and ensure the Citizen App remains lightning-fast for all users.

---

## 🧐 1. Why do we need Redis?

When a disaster (like an earthquake) occurs, the usage of the RakshaSetu app will spike from 0 to 10,000+ active users in seconds. 
During this panic, users will:
1. Constantly refresh the Heatmap (`/api/v1/incidents`).
2. Constantly query for nearby safe zones/hospitals (`/api/v1/relief-centers/fetch-automated`).

If the Express backend queries PostgreSQL or Mapbox for *every single one of these 10,000 requests*, two things happen:
- **PostgreSQL Exhaustion:** The database CPU hits 100%, causing SOS alerts (the most critical feature) to fail or timeout.
- **Third-Party Rate Limits:** Mapbox will temporarily block our API key for spamming them with identical latitude/longitude queries.

### The Solution
We introduce **Redis** as a caching and rate-limiting layer. Redis stores data entirely in RAM, making it roughly 100x faster than PostgreSQL for read operations. 

---

## 🛠️ 2. What exactly are we building?

We will implement three specific systems using Redis:

1. **The Bouncer (Rate Limiting)**
   - We will use `express-rate-limit` combined with `rate-limit-redis`.
   - Redis will keep track of how many times an IP address hits our server in a 1-minute window.
   - If a user/bot spams the server > 100 times in 60 seconds, Redis blocks them instantly at the middleware layer, saving the rest of the app.

2. **The Heatmap Cache (Short-TTL Caching)**
   - When User A requests active incidents for their city, we pull it from PostgreSQL and save the JSON string in Redis with a Time-To-Live (TTL) of **60 seconds**.
   - For the next 60 seconds, the 9,999 other users in that city get their data served *instantly* from Redis RAM. PostgreSQL CPU stays at ~5%.

3. **The Mapbox POI Cache (Mid-TTL Caching)**
   - When User A requests nearby hospitals, we hit Mapbox, then save the data in Redis with a TTL of **10 minutes** (hospitals don't move often).
   - This prevents us from hitting Mapbox rate limits and saves external API costs.

---

## 🚀 3. Step-by-Step Implementation Guide

Follow these exact steps to implement this in the `user-be` package.

### Step 1: Provision the Managed Database
1. Go to [Upstash](https://upstash.com/) or Redis Cloud.
2. Create a Free Serverless Redis Database.
3. Copy the highly secure connection string (URL). It will look like: `rediss://default:PASSWORD@endpoint.upstash.io:32456`.
4. Add it to `packages/user-be/.env`:
   ```env
   REDIS_URL="rediss://default:YOUR_PASSWORD@endpoint.upstash.io:32456"
   ```

### Step 2: Install Required Packages
Navigate to `packages/user-be` and run:
```bash
bun add redis express-rate-limit rate-limit-redis
```

### Step 3: Create the Redis Service
Create a new file at `packages/user-be/src/common/db/redis.ts`:

```typescript
import { createClient } from "redis";
import { env } from "../../config/env";

export const redisClient = createClient({
  url: env.redisUrl 
});

redisClient.on("error", (err) => console.error("[Redis] Client Error", err));
redisClient.on("connect", () => console.log("[Redis] Connected securely to Managed Service"));

export async function connectRedis() {
  await redisClient.connect();
}
```
*Don't forget to call `await connectRedis()` in your `src/index.ts`!*

### Step 4: Add The Global Rate Limiter
In `packages/user-be/src/index.ts`, configure the rate limiter to use Redis memory instead of local server memory (critical for instances where you run multiple Node servers):

```typescript
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "./common/db/redis";

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per `window` (here, per minute)
  standardHeaders: true, 
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
});

app.use("/api/", globalLimiter);
```

### Step 5: Implement Mapbox / POI Caching
Modify `packages/user-be/src/modules/relief-centers/relief-centers.controller.ts`:

```typescript
import { redisClient } from "../../common/db/redis";

router.post("/fetch-automated", async (req, res, next) => {
  try {
    const { latitude, longitude, radiusMeters } = req.body;
    
    // 1. Create a unique cache key based on approx coordinates
    // We round to 2 or 3 decimals so users standing near each other share the same cache!
    const latRounded = Number(latitude).toFixed(2);
    const lngRounded = Number(longitude).toFixed(2);
    const cacheKey = `poi:hospitals:${latRounded}:${lngRounded}`;

    // 2. Check Redis FIRST
    const cachedPOI = await redisClient.get(cacheKey);
    if (cachedPOI) {
        console.log("[Cache] Serving POIs from Redis!");
        return res.json({ success: true, data: JSON.parse(cachedPOI) });
    }

    // 3. Fallback: Fetch from Mapbox 
    const result = await fetchAndSaveReliefCenters(Number(latitude), Number(longitude), radiusMeters ? Number(radiusMeters) : 30000);
    
    // 4. Save to Redis for 10 minutes (600 seconds)
    await redisClient.setEx(cacheKey, 600, JSON.stringify(result));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
```

---

## 🎯 Final Outcome
Once these 5 steps are implemented, the `user-be` package will be highly resilient. During a disaster spike, AWS/Upstash will handle thousands of read requests per second from RAM, keeping your PostgreSQL database and External APIs completely isolated from the traffic surge.
