import { randomUUID } from "node:crypto";
import { prisma } from "../../common/db/prisma";

export interface StatusEventRow {
  id: string;
  incidentId: string;
  actorUserId: string | null;
  previousStatus: string | null;
  newStatus: string;
  source: string;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
}

export async function createStatusEvent(data: {
  incidentId: string;
  actorUserId: string | null;
  previousStatus: string | null;
  newStatus: string;
  source?: string;
  message?: string;
  metadata?: unknown;
}) {
  const id = randomUUID();

  const rows = await prisma.$queryRaw<StatusEventRow[]>`
    INSERT INTO "IncidentStatusEvent" (
      "id", "incidentId", "actorUserId",
      "previousStatus", "newStatus",
      "source", "message", "metadata",
      "createdAt"
    ) VALUES (
      ${id}::uuid,
      ${data.incidentId}::uuid,
      ${data.actorUserId ?? null}::uuid,
      ${data.previousStatus ?? null}::"IncidentStatus",
      ${data.newStatus}::"IncidentStatus",
      ${data.source ?? "system"},
      ${data.message ?? null},
      ${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb,
      NOW()
    )
    RETURNING
      "id"::text AS "id",
      "incidentId"::text AS "incidentId",
      CASE WHEN "actorUserId" IS NULL THEN NULL ELSE "actorUserId"::text END AS "actorUserId",
      "previousStatus"::text AS "previousStatus",
      "newStatus"::text AS "newStatus",
      "source",
      "message",
      "metadata",
      "createdAt" AS "createdAt"
  `;

  return rows[0];
}

export async function listEventsByIncident(incidentId: string) {
  return prisma.$queryRaw<Array<StatusEventRow & { actorName: string | null }>>`
    SELECT
      e."id"::text AS "id",
      e."incidentId"::text AS "incidentId",
      CASE WHEN e."actorUserId" IS NULL THEN NULL ELSE e."actorUserId"::text END AS "actorUserId",
      e."previousStatus"::text AS "previousStatus",
      e."newStatus"::text AS "newStatus",
      e."source",
      e."message",
      e."metadata",
      e."createdAt" AS "createdAt",
      u."fullName" AS "actorName"
    FROM "IncidentStatusEvent" e
    LEFT JOIN "User" u ON e."actorUserId" = u."id"
    WHERE e."incidentId" = ${incidentId}::uuid
    ORDER BY e."createdAt" ASC
  `;
}
