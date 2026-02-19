import { AppError } from "../../common/utils/app-error";
import { sendNotificationToUser } from "../../common/services/notification.service";
import { emitIncidentAssignment } from "../../ws/events";
import { enqueueEvent } from "../outbox/outbox.service";
import {
  createAssignment as repoCreate,
  findAssignmentById,
  listAssignmentsByIncident,
  listAssignmentsByResponder,
  updateAssignmentStatus as repoUpdateStatus,
} from "./assignments.repo";
import type { CreateAssignmentInput, UpdateAssignmentStatusInput } from "./assignments.schema";

export async function assign(
  incidentId: string,
  assignedById: string,
  input: CreateAssignmentInput,
) {
  const assignment = await repoCreate(incidentId, assignedById, input);

  // Publish to Outbox
  await enqueueEvent({
    aggregateType: "Assignment",
    aggregateId: assignment.id,
    eventType: "AssignmentCreated",
    partitionKey: incidentId, // Partition by incident to keep order
    payload: assignment,
    createdById: assignedById,
  });

  // Notify the responder in real-time
  if (assignment.responderId) {
    emitIncidentAssignment(assignment.responderId, {
      assignmentId: assignment.id,
      incidentId: assignment.incidentId,
      teamId: assignment.teamId,
      status: assignment.status,
    });

    // Send Push Notification
    await sendNotificationToUser(
      assignment.responderId,
      "New Assignment",
      "You have been assigned to an incident.",
      { incidentId: assignment.incidentId, assignmentId: assignment.id }
    );
  }

  return assignment;
}

export async function updateStatus(
  assignmentId: string,
  input: UpdateAssignmentStatusInput,
  actorId: string,
) {
  const existing = await findAssignmentById(assignmentId);
  if (!existing) {
    throw new AppError("Assignment not found", 404);
  }

  const updated = await repoUpdateStatus(assignmentId, input.status, input.note);

  // Publish to Outbox
  await enqueueEvent({
    aggregateType: "Assignment",
    aggregateId: assignmentId,
    eventType: "AssignmentStatusUpdated",
    partitionKey: existing.incidentId,
    payload: updated,
    createdById: actorId,
  });

  return updated;
}

export async function getMyAssignments(responderId: string) {
  return listAssignmentsByResponder(responderId);
}

export async function getIncidentAssignments(incidentId: string) {
  return listAssignmentsByIncident(incidentId);
}
