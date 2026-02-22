import { AppError } from "../../common/utils/app-error";
import { findIncidentById } from "./incidents.repo";
import * as repo from "./upvotes.repo";

export async function toggleUpvote(incidentId: string, userId: string) {
  // Verify incident exists
  const incident = await findIncidentById(incidentId);
  if (!incident) {
    throw new AppError("Incident not found", 404);
  }

  const result = await repo.toggleUpvote(incidentId, userId);
  const info = await repo.getUpvoteInfo(incidentId, userId);

  return {
    incidentId,
    voted: result.voted,
    count: info.count,
  };
}

export async function getUpvoteInfo(incidentId: string, userId: string) {
  return repo.getUpvoteInfo(incidentId, userId);
}

export async function getUpvotesForIncidents(incidentIds: string[], userId: string) {
  return repo.getUpvotesForIncidents(incidentIds, userId);
}
