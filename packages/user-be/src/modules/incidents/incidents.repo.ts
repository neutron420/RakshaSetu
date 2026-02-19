import { randomUUID } from "node:crypto";
import { prisma } from "../../common/db/prisma";
import type { CreateIncidentInput, ListIncidentsQuery, UpdateIncidentInput } from "./incidents.schema";

// ── Row types ────────────────────────────────────────────────────────

export interface IncidentRow {
  id: string;
  category: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  reportCount: number;
  confidenceScore: number | null;
  clusterRadiusMeters: number;
  centroidLat: number;
  centroidLng: number;
  firstReportedAt: Date;
  lastReportedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Create ───────────────────────────────────────────────────────────

export async function createIncident(input: CreateIncidentInput) {
  const id = randomUUID();
  const now = new Date();

  const rows = await prisma.$queryRaw<IncidentRow[]>`
    INSERT INTO "Incident" (
      "id", "category", "status", "priority",
      "title", "description", "reportCount",
      "clusterRadiusMeters",
      "centroidLat", "centroidLng", "centroidGeo",
      "firstReportedAt", "lastReportedAt",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}::uuid,
      ${input.category}::"SosCategory",
      'OPEN'::"IncidentStatus",
      ${input.priority}::"IncidentPriority",
      ${input.title},
      ${input.description ?? null},
      0,
      ${input.clusterRadiusMeters ?? 1000},
      ${input.centroidLat},
      ${input.centroidLng},
      ST_SetSRID(ST_MakePoint(${input.centroidLng}, ${input.centroidLat}), 4326)::geography,
      ${now},
      ${now},
      ${now},
      ${now}
    )
    RETURNING
      "id"::text AS "id",
      "category"::text AS "category",
      "status"::text AS "status",
      "priority"::text AS "priority",
      "title", "description",
      "reportCount" AS "reportCount",
      "confidenceScore"::float8 AS "confidenceScore",
      "clusterRadiusMeters" AS "clusterRadiusMeters",
      "centroidLat"::float8 AS "centroidLat",
      "centroidLng"::float8 AS "centroidLng",
      "firstReportedAt" AS "firstReportedAt",
      "lastReportedAt" AS "lastReportedAt",
      "resolvedAt" AS "resolvedAt",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
  `;

  return rows[0];
}

// ── Find by ID ───────────────────────────────────────────────────────

export async function findIncidentById(id: string) {
  const rows = await prisma.$queryRaw<IncidentRow[]>`
    SELECT
      "id"::text AS "id",
      "category"::text AS "category",
      "status"::text AS "status",
      "priority"::text AS "priority",
      "title", "description",
      "reportCount" AS "reportCount",
      "confidenceScore"::float8 AS "confidenceScore",
      "clusterRadiusMeters" AS "clusterRadiusMeters",
      "centroidLat"::float8 AS "centroidLat",
      "centroidLng"::float8 AS "centroidLng",
      "firstReportedAt" AS "firstReportedAt",
      "lastReportedAt" AS "lastReportedAt",
      "resolvedAt" AS "resolvedAt",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
    FROM "Incident"
    WHERE "id" = ${id}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

// ── List with filters + pagination ───────────────────────────────────

export async function listIncidents(query: ListIncidentsQuery) {
  const offset = (query.page - 1) * query.limit;

  const rows = await prisma.$queryRaw<IncidentRow[]>`
    SELECT
      "id"::text AS "id",
      "category"::text AS "category",
      "status"::text AS "status",
      "priority"::text AS "priority",
      "title", "description",
      "reportCount" AS "reportCount",
      "confidenceScore"::float8 AS "confidenceScore",
      "clusterRadiusMeters" AS "clusterRadiusMeters",
      "centroidLat"::float8 AS "centroidLat",
      "centroidLng"::float8 AS "centroidLng",
      "firstReportedAt" AS "firstReportedAt",
      "lastReportedAt" AS "lastReportedAt",
      "resolvedAt" AS "resolvedAt",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
    FROM "Incident"
    WHERE
      (${query.status ?? null}::"IncidentStatus" IS NULL OR "status" = ${query.status ?? null}::"IncidentStatus")
      AND (${query.priority ?? null}::"IncidentPriority" IS NULL OR "priority" = ${query.priority ?? null}::"IncidentPriority")
      AND (${query.category ?? null}::"SosCategory" IS NULL OR "category" = ${query.category ?? null}::"SosCategory")
    ORDER BY "lastReportedAt" DESC
    LIMIT ${query.limit}
    OFFSET ${offset}
  `;

  return rows;
}

export async function countIncidents(query: ListIncidentsQuery) {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "Incident"
    WHERE
      (${query.status ?? null}::"IncidentStatus" IS NULL OR "status" = ${query.status ?? null}::"IncidentStatus")
      AND (${query.priority ?? null}::"IncidentPriority" IS NULL OR "priority" = ${query.priority ?? null}::"IncidentPriority")
      AND (${query.category ?? null}::"SosCategory" IS NULL OR "category" = ${query.category ?? null}::"SosCategory")
  `;

  return Number(rows[0].count);
}

// ── Update ───────────────────────────────────────────────────────────

export async function updateIncident(id: string, input: UpdateIncidentInput) {
  const now = new Date();

  const rows = await prisma.$queryRaw<IncidentRow[]>`
    UPDATE "Incident"
    SET
      "title"       = COALESCE(${input.title ?? null}, "title"),
      "description" = COALESCE(${input.description ?? null}, "description"),
      "status"      = COALESCE(${input.status ?? null}::"IncidentStatus", "status"),
      "priority"    = COALESCE(${input.priority ?? null}::"IncidentPriority", "priority"),
      "resolvedAt"  = CASE
                        WHEN ${input.status ?? null}::"IncidentStatus" IN ('RESOLVED', 'CLOSED') THEN ${now}
                        ELSE "resolvedAt"
                      END,
      "updatedAt"   = ${now}
    WHERE "id" = ${id}::uuid
    RETURNING
      "id"::text AS "id",
      "category"::text AS "category",
      "status"::text AS "status",
      "priority"::text AS "priority",
      "title", "description",
      "reportCount" AS "reportCount",
      "confidenceScore"::float8 AS "confidenceScore",
      "clusterRadiusMeters" AS "clusterRadiusMeters",
      "centroidLat"::float8 AS "centroidLat",
      "centroidLng"::float8 AS "centroidLng",
      "firstReportedAt" AS "firstReportedAt",
      "lastReportedAt" AS "lastReportedAt",
      "resolvedAt" AS "resolvedAt",
      "createdAt" AS "createdAt",
      "updatedAt" AS "updatedAt"
  `;

  return rows[0] ?? null;
}

// ── Link SOS Report to Incident ──────────────────────────────────────

export async function linkReportToIncident(incidentId: string, reportId: string) {
  await prisma.$queryRaw`
    UPDATE "SosReport"
    SET "incidentId" = ${incidentId}::uuid,
        "status" = 'LINKED'::"SosReportStatus",
        "updatedAt" = NOW()
    WHERE "id" = ${reportId}::uuid
  `;

  await prisma.$queryRaw`
    UPDATE "Incident"
    SET "reportCount" = "reportCount" + 1,
        "lastReportedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${incidentId}::uuid
  `;
}
