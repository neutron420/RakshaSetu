import { createReliefCenter, findNearbyReliefCenters, findReliefCenterById, updateReliefCenterById, upsertReliefCentersBulk } from "./relief-centers.repo";
import type { CreateReliefCenterInput, UpdateReliefCenterInput } from "./relief-centers.schema";
import { AppError } from "../../common/utils/app-error";
import { broadcast } from "../../ws";
import { fetchReliefCentersFromMapbox } from "./mapbox.service";

export async function addReliefCenter(input: CreateReliefCenterInput) {
  return createReliefCenter(input);
}

export async function getNearbyCenters(lat: number, lng: number, radiusMeters: number) {
  return findNearbyReliefCenters(lat, lng, radiusMeters);
}

export async function getCenterDetails(id: string) {
  const center = await findReliefCenterById(id);
  if (!center) throw new AppError("Relief center not found", 404);
  return center;
}

export async function updateCenterStatus(id: string, input: UpdateReliefCenterInput) {
  const updated = await updateReliefCenterById(id, input);
  
  // Broadcast update for real-time occupancy
  broadcast({
    type: "relief-center:update",
    payload: {
      id: updated.id,
      status: updated.status,
      currentCount: updated.currentCount,
    }
  });
  
  return updated;
}

export async function fetchAndSaveReliefCenters(lat: number, lng: number, radiusMeters: number = 30000) {
  // 1. Fetch from Mapbox API
  const centers = await fetchReliefCentersFromMapbox(lat, lng, radiusMeters);

  if (centers.length === 0) {
    return { added: 0, totalProcessed: 0, message: "No relief centers found in this area via Mapbox." };
  }

  // 2. Upsert to DB
  const result = await upsertReliefCentersBulk(centers);
  return result;
}
