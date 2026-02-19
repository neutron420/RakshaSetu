import { prisma } from "../../common/db/prisma";
import type { CreateAssignmentInput } from "./assignments.schema";

export async function createAssignment(
  incidentId: string,
  assignedById: string,
  input: CreateAssignmentInput,
) {
  return prisma.incidentAssignment.create({
    data: {
      incidentId,
      teamId: input.teamId,
      responderId: input.responderId ?? null,
      assignedById,
      note: input.note ?? null,
    },
    select: {
      id: true,
      incidentId: true,
      teamId: true,
      responderId: true,
      assignedById: true,
      status: true,
      note: true,
      assignedAt: true,
    },
  });
}

export async function findAssignmentById(id: string) {
  return prisma.incidentAssignment.findUnique({
    where: { id },
    select: {
      id: true,
      incidentId: true,
      teamId: true,
      responderId: true,
      assignedById: true,
      status: true,
      note: true,
      assignedAt: true,
      acknowledgedAt: true,
      arrivedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      incident: { select: { id: true, title: true, status: true, category: true } },
      team: { select: { id: true, name: true, code: true } },
      responder: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function updateAssignmentStatus(
  id: string,
  status: string,
  note: string | undefined,
) {
  const now = new Date();

  const timestampUpdates: Record<string, Date> = {};
  if (status === "ACKNOWLEDGED") timestampUpdates.acknowledgedAt = now;
  if (status === "ON_SITE") timestampUpdates.arrivedAt = now;
  if (status === "COMPLETED" || status === "CANCELED") timestampUpdates.completedAt = now;

  return prisma.incidentAssignment.update({
    where: { id },
    data: {
      status: status as any,
      note: note ?? undefined,
      ...timestampUpdates,
    },
    select: {
      id: true,
      incidentId: true,
      teamId: true,
      responderId: true,
      status: true,
      note: true,
      assignedAt: true,
      acknowledgedAt: true,
      arrivedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });
}

export async function listAssignmentsByResponder(responderId: string) {
  return prisma.incidentAssignment.findMany({
    where: { responderId },
    select: {
      id: true,
      incidentId: true,
      teamId: true,
      status: true,
      note: true,
      assignedAt: true,
      acknowledgedAt: true,
      arrivedAt: true,
      completedAt: true,
      incident: {
        select: {
          id: true, title: true, category: true, status: true, priority: true,
          centroidLat: true, centroidLng: true,
        },
      },
      team: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

export async function listAssignmentsByIncident(incidentId: string) {
  return prisma.incidentAssignment.findMany({
    where: { incidentId },
    select: {
      id: true,
      teamId: true,
      responderId: true,
      status: true,
      note: true,
      assignedAt: true,
      acknowledgedAt: true,
      arrivedAt: true,
      completedAt: true,
      team: { select: { id: true, name: true, code: true } },
      responder: { select: { id: true, fullName: true } },
      assignedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}
