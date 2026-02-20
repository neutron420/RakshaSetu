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

/** Claim pending messages (PENDING → PROCESSING) with row lock to avoid duplicate delivery across workers. */
export async function claimPendingMessages(batchSize = 10) {
  type ClaimedRow = {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    partitionKey: string;
    payload: unknown;
    headers: unknown;
    retries: number;
    createdAt: Date;
  };

  const rows = await prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<ClaimedRow[]>`
      WITH to_claim AS (
        SELECT id FROM "EventOutboxMessage"
        WHERE "publishStatus" = 'PENDING' AND "availableAt" <= NOW()
        ORDER BY "availableAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "EventOutboxMessage" m
      SET "publishStatus" = 'PROCESSING'
      FROM to_claim
      WHERE m.id = to_claim.id
      RETURNING
        m.id::text AS id,
        m."aggregateType" AS "aggregateType",
        m."aggregateId"::text AS "aggregateId",
        m."eventType" AS "eventType",
        m."partitionKey" AS "partitionKey",
        m.payload AS payload,
        m.headers AS headers,
        m.retries AS retries,
        m."createdAt" AS "createdAt"
    `;
    return claimed;
  });

  return rows;
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
