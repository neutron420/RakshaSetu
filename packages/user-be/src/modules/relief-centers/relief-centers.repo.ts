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
