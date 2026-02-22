import { createReliefCenter, findNearbyReliefCenters, findReliefCenterById, updateReliefCenterById } from "./relief-centers.repo";
import type { CreateReliefCenterInput, UpdateReliefCenterInput } from "./relief-centers.schema";
import { AppError } from "../../common/utils/app-error";
import { broadcast } from "../../ws";

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
