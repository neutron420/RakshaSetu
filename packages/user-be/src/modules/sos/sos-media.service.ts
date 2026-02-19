import { AppError } from "../../common/utils/app-error";
import { addMedia as repoAdd, listMediaByReport } from "./sos-media.repo";

export async function registerMedia(
  reportId: string,
  input: { mediaType: string; url: string; thumbnailUrl?: string; metadata?: unknown },
) {
  return repoAdd({ reportId, ...input });
}

export async function getReportMedia(reportId: string) {
  return listMediaByReport(reportId);
}
