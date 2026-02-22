import { listMediaByIncident } from "../sos/sos-media.repo";
import { getPublicUrl } from "../../common/services/storage.service";

export async function getIncidentMedia(incidentId: string) {
  const media = await listMediaByIncident(incidentId);
  return media.map((m) => ({
    ...m,
    url: getPublicUrl(m.url),
    thumbnailUrl: m.thumbnailUrl ? getPublicUrl(m.thumbnailUrl) : null,
  }));
}
