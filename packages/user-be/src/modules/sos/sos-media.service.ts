import { AppError } from "../../common/utils/app-error";
import { addMedia as repoAdd, listMediaByReport } from "./sos-media.repo";
import { getPublicUrl } from "../../common/services/storage.service";

export async function registerMedia(
  reportId: string,
  input: { mediaType: string; url: string; thumbnailUrl?: string; metadata?: unknown },
) {
  console.log(`[media] Registering media for report ${reportId}:`, input);
  return repoAdd({ reportId, ...input });
}

export async function getReportMedia(reportId: string) {
  const media = await listMediaByReport(reportId);
  return media.map((m) => ({
    ...m,
    url: getPublicUrl(m.url),
    thumbnailUrl: m.thumbnailUrl ? getPublicUrl(m.thumbnailUrl) : null,
  }));
}
