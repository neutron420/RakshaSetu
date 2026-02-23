import { randomUUID } from "node:crypto";
import { prisma } from "../../common/db/prisma";
import type { CreateIncidentInput, ListIncidentsQuery, UpdateIncidentInput, ListNearbyQuery } from "./incidents.schema";

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
  representativeMediaUrl?: string | null;
}

// ── Create ───────────────────────────────────────────────────────────

export async function createIncident(input: CreateIncidentInput) {
  const id = randomUUID();
  const now = new Date();

  console.log(`[incidents:repo] Creating incident ${id} for category ${input.category}`);

  try {
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
        1,
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

    console.log(`[incidents:repo] Successfully inserted incident ${id}`);
    return rows[0];
  } catch (err: any) {
    console.error(`[incidents:repo] FAILED to insert incident: ${err.message}`);
    throw err;
  }
}

// ── Find by ID ───────────────────────────────────────────────────────

export async function findIncidentById(id: string) {
  const rows = await prisma.$queryRaw<IncidentRow[]>`
    SELECT
      i."id"::text AS "id",
      i."category"::text AS "category",
      i."status"::text AS "status",
      i."priority"::text AS "priority",
      i."title", i."description",
      i."reportCount" AS "reportCount",
      i."confidenceScore"::float8 AS "confidenceScore",
      i."clusterRadiusMeters" AS "clusterRadiusMeters",
      i."centroidLat"::float8 AS "centroidLat",
      i."centroidLng"::float8 AS "centroidLng",
      i."firstReportedAt" AS "firstReportedAt",
      i."lastReportedAt" AS "lastReportedAt",
      i."resolvedAt" AS "resolvedAt",
      i."createdAt" AS "createdAt",
      i."updatedAt" AS "updatedAt",
      m."url" AS "representativeMediaUrl"
    FROM "Incident" i
    LEFT JOIN LATERAL (
      SELECT "url"
      FROM "SosReportMedia" sm
      JOIN "SosReport" sr ON sr."id" = sm."reportId"
      WHERE sr."incidentId" = i."id"
      ORDER BY sm."uploadedAt" ASC
      LIMIT 1
    ) m ON true
    WHERE i."id" = ${id}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}


export async function findNearbyIncident(params: {
  latitude: number;
  longitude: number;
  category: string;
  radiusMeters: number;
}) {
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
    WHERE "status" NOT IN ('RESOLVED', 'CLOSED')
      AND "category" = ${params.category}::"SosCategory"
      AND ST_DWithin(
        "centroidGeo",
        ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography,
        ${params.radiusMeters}
      )
    ORDER BY ST_Distance(
      "centroidGeo",
      ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography
    ) ASC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listNearbyIncidents(query: ListNearbyQuery) {
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
      (${query.status ?? null}::text IS NULL OR "status" = ${query.status ?? null}::"IncidentStatus")
      AND (${query.category ?? null}::text IS NULL OR "category" = ${query.category ?? null}::"SosCategory")
      AND ST_DWithin(
        "centroidGeo",
        ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography,
        ${query.radiusMeters}
      )
    ORDER BY ST_Distance(
      "centroidGeo",
      ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography
    ) ASC
    LIMIT 100
  `;

  return rows;
}

// ── List with filters + pagination ───────────────────────────────────

export async function listIncidents(query: ListIncidentsQuery) {
  const offset = (query.page - 1) * query.limit;

  const rows = await prisma.$queryRaw<IncidentRow[]>`
    SELECT
      i."id"::text AS "id",
      i."category"::text AS "category",
      i."status"::text AS "status",
      i."priority"::text AS "priority",
      i."title", i."description",
      i."reportCount" AS "reportCount",
      i."confidenceScore"::float8 AS "confidenceScore",
      i."clusterRadiusMeters" AS "clusterRadiusMeters",
      i."centroidLat"::float8 AS "centroidLat",
      i."centroidLng"::float8 AS "centroidLng",
      i."firstReportedAt" AS "firstReportedAt",
      i."lastReportedAt" AS "lastReportedAt",
      i."resolvedAt" AS "resolvedAt",
      i."createdAt" AS "createdAt",
      i."updatedAt" AS "updatedAt",
      m."url" AS "representativeMediaUrl"
    FROM "Incident" i
    LEFT JOIN LATERAL (
      SELECT "url"
      FROM "SosReportMedia" sm
      JOIN "SosReport" sr ON sr."id" = sm."reportId"
      WHERE sr."incidentId" = i."id"
      ORDER BY sm."uploadedAt" DESC
      LIMIT 1
    ) m ON true
    WHERE
      (${query.status ?? null}::text IS NULL OR i."status" = ${query.status ?? null}::"IncidentStatus")
      AND (${query.priority ?? null}::text IS NULL OR i."priority" = ${query.priority ?? null}::"IncidentPriority")
      AND (${query.category ?? null}::text IS NULL OR i."category" = ${query.category ?? null}::"SosCategory")
    ORDER BY i."lastReportedAt" DESC
    LIMIT ${query.limit}
    OFFSET ${offset}
  `;

  console.log(`[incidents:repo] listIncidents: found ${rows.length} incidents for query:`, JSON.stringify(query));
  return rows;
}

export async function countIncidents(query: ListIncidentsQuery) {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "Incident"
    WHERE
      (${query.status ?? null}::text IS NULL OR "status" = ${query.status ?? null}::"IncidentStatus")
      AND (${query.priority ?? null}::text IS NULL OR "priority" = ${query.priority ?? null}::"IncidentPriority")
      AND (${query.category ?? null}::text IS NULL OR "category" = ${query.category ?? null}::"SosCategory")
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
