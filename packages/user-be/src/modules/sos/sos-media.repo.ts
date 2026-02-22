import { prisma } from "../../common/db/prisma";

export async function addMedia(data: {
  reportId: string;
  mediaType:string;
  url: string;
  thumbnailUrl?: string;
  metadata?: unknown;
}) {
  return prisma.sosReportMedia.create({
    data: {
      reportId: data.reportId,
      mediaType: data.mediaType as any,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl ?? null,
      metadata: data.metadata ?? undefined,
    },
    select: {
      id : true,
      reportId: true,
      mediaType: true,
      url: true,
      thumbnailUrl: true,
      metadata: true,
      uploadedAt: true,
    },
  });
}

export async function listMediaByReport(reportId: string) {
  return prisma.sosReportMedia.findMany({
    where: { reportId },
    select: {
      id : true,
      reportId: true,
      mediaType: true,
      url: true,
      thumbnailUrl: true,
      metadata: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: "asc"},
  });
}

export async function listMediaByIncident(incidentId: string) {
  return prisma.sosReportMedia.findMany({
    where: {
      report: {
        incidentId: incidentId as any
      }
    },
    select: {
      id : true,
      reportId: true,
      mediaType: true,
      url: true,
      thumbnailUrl: true,
      metadata: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: "asc"},
  });
}
