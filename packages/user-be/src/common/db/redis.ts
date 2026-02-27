import { createClient } from "redis";
import { env } from "../../config/env";
const url = env.redisUrl || "redis://localhost:6379";

export const redisClient = createClient({
  url,
});

redisClient.on("error", (err) => {
  console.error("[Redis] Client Error:", err.message || err);
});

redisClient.on("connect", () => {
  console.log(`[Redis] Connected successfully to ${env.redisUrl ? "Managed Service" : "Localhost"}`);
});

let isConnected = false;

export async function connectRedis() {
  if (isConnected) return;
  
  try {
    await redisClient.connect();
    isConnected = true;
  } catch (error) {
    console.error("[Redis] Failed to connect on startup. Continuing without cache.", error);
  }
}

export async function disconnectRedis() {
  if (!isConnected) return;
  await redisClient.quit();
  isConnected = false;
  console.log("[Redis] Disconnected securely.");
}
