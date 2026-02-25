import { randomUUID } from "node:crypto";
import { prisma } from "../../common/db/prisma";
import type { CreateSosInput } from "./sos.schema";

export async function findByReporterAndClientReportId(reporterId: string, clientReportId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string; reportedAt: Date }>>`
    SELECT
      "id"::text AS "id",
      "status"::text AS "status",
      "reportedAt" AS "reportedAt"
    FROM "SosReport"
    WHERE "reporterId" = ${reporterId}::uuid
      AND "clientReportId" = ${clientReportId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function createSosReport(reporterId: string, input: CreateSosInput, aiResult?: { translatedText?: string; severityScore?: number }) {
  const reportId = randomUUID();

  const inserted = await prisma.$queryRaw<Array<{ id: string; status: string; reportedAt: Date }>>`
    INSERT INTO "SosReport" (
      "id",
      "reporterId",
      "category",
      "description",
      "translatedDescription",
      "aiSeverityScore",
      "clientReportId",
      "latitude",
      "longitude",
      "locationGeo",
      "reportedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${reportId}::uuid,
      ${reporterId}::uuid,
      ${input.category}::"SosCategory",
      ${input.description ?? null},
      ${aiResult?.translatedText ?? null},
      ${aiResult?.severityScore ?? null},
      ${input.clientReportId ?? null},
      ${input.latitude},
      ${input.longitude},
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT ("reporterId", "clientReportId")
    DO UPDATE SET "updatedAt" = "SosReport"."updatedAt"
    RETURNING "id"::text AS "id", "status"::text AS "status", "reportedAt" AS "reportedAt"
  `;

  return inserted[0];
}

export async function listMyReports(reporterId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      incidentId: string | null;
      category: string;
      status: string;
      verificationStatus: string;
      description: string | null;
      latitude: number;
      longitude: number;
      reportedAt: Date;
      createdAt: Date;
    }>
  >`
    SELECT
      "id"::text AS "id",
      CASE WHEN "incidentId" IS NULL THEN NULL ELSE "incidentId"::text END AS "incidentId",
      "category"::text AS "category",
      "status"::text AS "status",
      "verificationStatus"::text AS "verificationStatus",
      "description",
      "latitude"::float8 AS "latitude",
      "longitude"::float8 AS "longitude",
      "reportedAt" AS "reportedAt",
      "createdAt" AS "createdAt"
    FROM "SosReport"
    WHERE "reporterId" = ${reporterId}::uuid
    ORDER BY "reportedAt" DESC
    LIMIT 100
  `;
}
