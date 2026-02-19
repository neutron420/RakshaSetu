import { AppError } from "../../common/utils/app-error";
import { emitIncidentUpdate } from "../../ws/events";
import { enqueueEvent } from "../outbox/outbox.service";
import { logStatusChange } from "../timeline/timeline.service";
import {
  countIncidents,
  createIncident as repoCreate,
  findIncidentById,
  linkReportToIncident,
  listIncidents as repoList,
  updateIncident as repoUpdate,
} from "./incidents.repo";
import type {
  CreateIncidentInput,
  LinkReportInput,
  ListIncidentsQuery,
  UpdateIncidentInput,
} from "./incidents.schema";

export async function create(input: CreateIncidentInput) {
  const incident = await repoCreate(input);
  if (!incident) {
    throw new AppError("Failed to create incident", 500);
  }

  await enqueueEvent({
    aggregateType: "Incident",
    aggregateId: incident.id,
    eventType: "IncidentCreated",
    partitionKey: incident.id,
    payload: incident,
  });

  return incident;
}

export async function getById(id: string) {
  const incident = await findIncidentById(id);
  if (!incident) {
    throw new AppError("Incident not found", 404);
  }
  return incident;
}

export async function list(query: ListIncidentsQuery) {
  const [data, total] = await Promise.all([
    repoList(query),
    countIncidents(query),
  ]);

  return {
    data,
    meta: { page: query.page, limit: query.limit, total },
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

  return { incidentId, reportId: input.reportId, linked: true };
}
