import { prisma } from "../../common/db/prisma";

export async function createOutboxMessage(data: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  partitionKey: string;
  payload: unknown;
  createdById?: string;
}) {
  return prisma.eventOutboxMessage.create({
    data: {
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      partitionKey: data.partitionKey,
      payload: data.payload as any,
      createdById: data.createdById ?? null,
    },
    select: {
      id: true,
      aggregateType: true,
      aggregateId: true,
      eventType: true,
      publishStatus: true,
      createdAt: true,
    },
  });
}

export async function pollPendingMessages(batchSize = 10) {
  return prisma.eventOutboxMessage.findMany({
    where: {
      publishStatus: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { availableAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      aggregateType: true,
      aggregateId: true,
      eventType: true,
      partitionKey: true,
      payload: true,
      headers: true,
      retries: true,
      createdAt: true,
    },
  });
}

export async function markPublished(id: string) {
  return prisma.eventOutboxMessage.update({
    where: { id },
    data: {
      publishStatus: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
}

export async function markFailed(id: string, errorMessage: string) {
  return prisma.eventOutboxMessage.update({
    where: { id },
    data: {
      publishStatus: "FAILED",
      errorMessage,
      retries: { increment: 1 },
    },
  });
}
