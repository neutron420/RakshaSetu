import { redisClient } from "../common/db/redis";

const LOCATION_TTL_SECONDS = 300; 

export interface LocationData {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  updatedAt: string;
}

export async function setUserLatestLocation(userId: string, data: Omit<LocationData, "updatedAt">) {
  const payload: LocationData = { ...data, updatedAt: new Date().toISOString() };
  await redisClient.setEx(`live-loc:${userId}`, LOCATION_TTL_SECONDS, JSON.stringify(payload));
  return payload;
}

export async function getUserLatestLocation(userId: string): Promise<LocationData | null> {
  const data = await redisClient.get(`live-loc:${userId}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as LocationData;
  } catch {
    return null;
  }
}
