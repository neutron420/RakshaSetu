import { AppError } from "../../common/utils/app-error";
import { emitSosCreated } from "../../ws/events";
import { createSosReport, findByReporterAndClientReportId, listMyReports } from "./sos.repo";
import type { CreateSosInput } from "./sos.schema";

export async function submitSos(reporterId: string, input: CreateSosInput) {
  if (input.clientReportId) {
    const existing = await findByReporterAndClientReportId(reporterId, input.clientReportId);
    if (existing) {
      return {
        reportId: existing.id,
        status: existing.status,
        reportedAt: existing.reportedAt,
        duplicate: true,
      };
    }
  }

  const created = await createSosReport(reporterId, input);
  if (!created) {
    throw new AppError("Failed to create SOS report", 500);
  }

  emitSosCreated(reporterId, {
    reportId: created.id,
    category: input.category,
    latitude: input.latitude,
    longitude: input.longitude,
    reportedAt: created.reportedAt,
  });

  return {
    reportId: created.id,
    status: created.status,
    reportedAt: created.reportedAt,
    duplicate: false,
  };
}

export async function getMyReports(reporterId: string) {
  return listMyReports(reporterId);
}
