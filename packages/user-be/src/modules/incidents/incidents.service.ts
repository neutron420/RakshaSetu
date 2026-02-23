import { AppError } from "../../common/utils/app-error";
import { emitIncidentUpdate } from "../../ws/events";
import { enqueueEvent } from "../outbox/outbox.service";
import { logStatusChange } from "../timeline/timeline.service";
import { getPublicUrl } from "../../common/services/storage.service";
import {
  countIncidents,
  createIncident as repoCreate,
  findIncidentById,
  linkReportToIncident,
  listIncidents as repoList,
  listNearbyIncidents as repoListNearby,
  updateIncident as repoUpdate,
} from "./incidents.repo";
import type {
  CreateIncidentInput,
  LinkReportInput,
  ListIncidentsQuery,
  ListNearbyQuery,
  UpdateIncidentInput,
} from "./incidents.schema";

export async function create(input: CreateIncidentInput) {
  const incident = await repoCreate(input);
  if (!incident) {
    throw new AppError("Failed to create incident", 500);
  }

  try {
    await enqueueEvent({
      aggregateType: "Incident",
      aggregateId: incident.id,
      eventType: "IncidentCreated",
      partitionKey: incident.id,
      payload: incident,
    });
  } catch (err: any) {
    console.warn(`[incidents:service] Failed to enqueue IncidentCreated event: ${err.message}`);
  }


  emitIncidentUpdate({
    incidentId: incident.id,
    status: incident.status,
    priority: incident.priority,
    title: incident.title,
    category: incident.category,
    centroidLat: incident.centroidLat,
    centroidLng: incident.centroidLng,
  });

  return incident;
}

export async function getById(id: string) {
  const incident = await findIncidentById(id);
  if (!incident) {
    throw new AppError("Incident not found", 404);
  }
  return {
    ...incident,
    representativeMediaUrl: incident.representativeMediaUrl ? getPublicUrl(incident.representativeMediaUrl) : null
  };
}

export async function list(query: ListIncidentsQuery) {
  const [data, total] = await Promise.all([
    repoList(query),
    countIncidents(query),
  ]);

  return {
    data: data.map(item => ({
      ...item,
      representativeMediaUrl: item.representativeMediaUrl ? getPublicUrl(item.representativeMediaUrl) : null
    })),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function listNearby(query: ListNearbyQuery) {
  const data = await repoListNearby(query);

  return {
    data: data.map(item => ({
      ...item,
      representativeMediaUrl: item.representativeMediaUrl ? getPublicUrl(item.representativeMediaUrl) : null
    })),
  };
}


export async function update(id: string, input: UpdateIncidentInput, actorId: string) {
  const existing = await findIncidentById(id);
  if (!existing) {
    throw new AppError("Incident not found", 404);
  }

  const updated = await repoUpdate(id, input);
  if (!updated) {
    throw new AppError("Failed to update incident", 500);
  }

  // Log status change to timeline
  if (existing.status !== updated.status) {
    await logStatusChange({
      incidentId: id,
      actorUserId: actorId,
      previousStatus: existing.status,
      newStatus: updated.status,
      message: `Status updated to ${updated.status}`,
    });
  }

  // Publish to Outbox
  await enqueueEvent({
    aggregateType: "Incident",
    aggregateId: id,
    eventType: "IncidentUpdated",
    partitionKey: id,
    payload: updated,
    createdById: actorId,
  });

  // Emit WS event for real-time updates
  emitIncidentUpdate({
    incidentId: updated.id,
    status: updated.status,
    priority: updated.priority,
    title: updated.title,
    category: updated.category,
    centroidLat: updated.centroidLat,
    centroidLng: updated.centroidLng,
  });

  return updated;
}

export async function linkReport(incidentId: string, input: LinkReportInput) {
  const incident = await findIncidentById(incidentId);
  if (!incident) {
    throw new AppError("Incident not found", 404);
  }

  await linkReportToIncident(incidentId, input.reportId);

  // Fetch updated incident to get fresh reportCount/status
  const updated = await findIncidentById(incidentId);

  // Emit refresh event for the community feed
  if (updated) {
    emitIncidentUpdate({
      incidentId: updated.id,
      status: updated.status,
      priority: updated.priority,
      title: updated.title,
      category: updated.category,
      centroidLat: updated.centroidLat,
      centroidLng: updated.centroidLng,
    });
  }

  return { incidentId, reportId: input.reportId, linked: true };
}
