import { prisma } from "../../common/db/prisma";
import type { CreateReliefCenterInput, UpdateReliefCenterInput } from "./relief-centers.schema";

export async function createReliefCenter(input: CreateReliefCenterInput) {
  const { latitude, longitude, ...rest } = input;
  
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO "ReliefCenter" (
      "id", "name", "type", "status", "description", "address", 
      "maxCapacity", "latitude", "longitude", "locationGeo", 
      "contactPhone", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${rest.name}, ${rest.type}::"ReliefCenterType", 
      ${rest.status}::"ReliefCenterStatus", ${rest.description ?? null}, 
      ${rest.address ?? null}, ${rest.maxCapacity ?? null}, 
      ${latitude}, ${longitude}, 
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
      ${rest.contactPhone ?? null}, NOW()
    ) RETURNING *
  `;
  
  return rows[0];
}

export async function findNearbyReliefCenters(lat: number, lng: number, radiusMeters: number) {
  return prisma.$queryRaw<any[]>`
    SELECT 
      id, name, type, status, description, address, 
      "maxCapacity", "currentCount", latitude, longitude, "contactPhone",
      ST_Distance(
        "locationGeo", 
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) as distance
    FROM "ReliefCenter"
    WHERE "isActive" = true
      AND ST_DWithin(
        "locationGeo", 
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY distance ASC
  `;
}

export async function findReliefCenterById(id: string) {
  return prisma.reliefCenter.findUnique({
    where: { id }
  });
}


export async function updateReliefCenterById(id: string, input: UpdateReliefCenterInput) {
  const { latitude, longitude, ...rest } = input;
  
  // Basic merge of data (not fully optimized for spatial but works for simple updates)
  return prisma.reliefCenter.update({
    where: { id },
    data: {
      ...rest,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
    }
  });
}

/**
 * Upserts relief centers. 
 * Checks if a center with the same name exists within ~100 meters to avoid duplicates.
 */
export async function upsertReliefCentersBulk(centers: CreateReliefCenterInput[]) {
  let newCount = 0;
  
  for (const center of centers) {
    // 1. Check if similar center exists (same name within 100 meters)
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM "ReliefCenter"
      WHERE name = ${center.name}
      AND ST_DWithin(
        "locationGeo", 
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
        100
      )
      LIMIT 1
    `;

    if (existing.length > 0) {
      // Already exists, skip or update. We'll just skip to prevent overwriting manual edits.
      continue;
    }

    // 2. Insert new center
    await prisma.$queryRaw<any[]>`
      INSERT INTO "ReliefCenter" (
        "id", "name", "type", "status", "description", "address", 
        "maxCapacity", "latitude", "longitude", "locationGeo", 
        "contactPhone", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${center.name}, ${center.type}::"ReliefCenterType", 
        ${center.status}::"ReliefCenterStatus", ${center.description ?? null}, 
        ${center.address ?? null}, ${center.maxCapacity ?? null}, 
        ${center.latitude}, ${center.longitude}, 
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
        ${center.contactPhone ?? null}, NOW()
      )
    `;
    newCount++;
  }
  
  return { added: newCount, totalProcessed: centers.length };
}

