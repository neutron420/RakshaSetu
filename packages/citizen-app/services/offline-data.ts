import { Q } from "@nozbe/watermelondb";
import { database, isWatermelonAvailable } from "../db";
import {
  getNearbyIncidentsApi,
  getNearbyReliefCentersApi,
  Incident,
  listIncidentsApi,
  ReliefCenter,
  ReliefCenterStatus,
} from "./api";

const INCIDENTS_TABLE = "incidents";
const RELIEF_CENTERS_TABLE = "relief_centers";
const useWatermelon = Boolean(database && isWatermelonAvailable);

const memoryIncidents = new Map<string, Incident>();
const memoryReliefCenters = new Map<string, ReliefCenter>();

function incidentsCollection() {
  if (!database) return null;
  return database.collections.get(INCIDENTS_TABLE);
}

function reliefCentersCollection() {
  if (!database) return null;
  return database.collections.get(RELIEF_CENTERS_TABLE);
}

function toMillis(value?: string | null): number {
  if (!value) return Date.now();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function toOptionalMillis(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function metersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function applyIncidentToRecord(record: any, incident: Incident) {
  record._raw.remote_id = incident.id;
  record._raw.category = incident.category;
  record._raw.status = incident.status;
  record._raw.priority = incident.priority;
  record._raw.severity = incident.severity ?? incident.priority;
  record._raw.title = incident.title;
  record._raw.description = incident.description ?? null;
  record._raw.centroid_lat = toNumber(incident.centroidLat);
  record._raw.centroid_lng = toNumber(incident.centroidLng);
  record._raw.cluster_radius_meters = toNumber(incident.clusterRadiusMeters, 1000);
  record._raw.report_count = toNumber(incident.reportCount, 1);
  record._raw.representative_media_url = incident.representativeMediaUrl ?? null;
  record._raw.confidence_score =
    incident.confidenceScore == null ? null : toNumber(incident.confidenceScore);
  record._raw.first_reported_at = toMillis(incident.firstReportedAt);
  record._raw.last_reported_at = toMillis(incident.lastReportedAt);
  record._raw.resolved_at = toOptionalMillis(incident.resolvedAt);
  record._raw.created_at = toMillis(incident.createdAt);
  record._raw.updated_at = toMillis(incident.updatedAt);
}

function incidentFromRecord(record: any): Incident {
  const raw = record._raw;
  return {
    id: String(raw.remote_id),
    category: raw.category,
    status: raw.status,
    priority: raw.priority,
    severity: raw.severity ?? raw.priority,
    title: raw.title,
    description: raw.description ?? null,
    centroidLat: toNumber(raw.centroid_lat),
    centroidLng: toNumber(raw.centroid_lng),
    clusterRadiusMeters: toNumber(raw.cluster_radius_meters, 1000),
    reportCount: toNumber(raw.report_count, 1),
    representativeMediaUrl: raw.representative_media_url ?? null,
    confidenceScore:
      raw.confidence_score == null ? null : toNumber(raw.confidence_score),
    firstReportedAt: new Date(toNumber(raw.first_reported_at)).toISOString(),
    lastReportedAt: new Date(toNumber(raw.last_reported_at)).toISOString(),
    resolvedAt:
      raw.resolved_at == null
        ? null
        : new Date(toNumber(raw.resolved_at)).toISOString(),
    createdAt: new Date(toNumber(raw.created_at)).toISOString(),
    updatedAt: new Date(toNumber(raw.updated_at)).toISOString(),
  };
}

function applyReliefCenterToRecord(record: any, center: ReliefCenter) {
  record._raw.remote_id = center.id;
  record._raw.name = center.name;
  record._raw.type = center.type;
  record._raw.status = center.status;
  record._raw.description = center.description ?? null;
  record._raw.address = center.address ?? null;
  record._raw.max_capacity =
    center.maxCapacity == null ? null : toNumber(center.maxCapacity);
  record._raw.current_count = toNumber(center.currentCount, 0);
  record._raw.latitude = toNumber(center.latitude);
  record._raw.longitude = toNumber(center.longitude);
  record._raw.contact_phone = center.contactPhone ?? null;
  record._raw.created_at = record._raw.created_at || Date.now();
  record._raw.updated_at = Date.now();
}

function reliefCenterFromRecord(record: any): ReliefCenter {
  const raw = record._raw;
  return {
    id: String(raw.remote_id),
    name: raw.name,
    type: raw.type,
    status: raw.status,
    description: raw.description ?? null,
    address: raw.address ?? null,
    maxCapacity: raw.max_capacity == null ? null : toNumber(raw.max_capacity),
    currentCount: toNumber(raw.current_count, 0),
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    contactPhone: raw.contact_phone ?? null,
  };
}

export async function cacheIncidents(incidents: Incident[]) {
  if (!incidents.length) return;
  if (!useWatermelon) {
    incidents.forEach((incident) => {
      memoryIncidents.set(incident.id, incident);
    });
    return;
  }

  const collection = incidentsCollection();
  if (!collection || !database) return;
  const ids = incidents.map((incident) => incident.id);
  const existingRows = await collection
    .query(Q.where("remote_id", Q.oneOf(ids)))
    .fetch();
  const existingById = new Map<string, any>();
  existingRows.forEach((row: any) => {
    existingById.set(String(row._raw.remote_id), row);
  });

  await database.write(async () => {
    for (const incident of incidents) {
      const existing = existingById.get(incident.id);
      if (existing) {
        await existing.update((record: any) => {
          applyIncidentToRecord(record, incident);
        });
      } else {
        await collection.create((record: any) => {
          applyIncidentToRecord(record, incident);
        });
      }
    }
  });
}

export async function cacheReliefCenters(centers: ReliefCenter[]) {
  if (!centers.length) return;
  if (!useWatermelon) {
    centers.forEach((center) => {
      memoryReliefCenters.set(center.id, center);
    });
    return;
  }

  const collection = reliefCentersCollection();
  if (!collection || !database) return;
  const ids = centers.map((center) => center.id);
  const existingRows = await collection
    .query(Q.where("remote_id", Q.oneOf(ids)))
    .fetch();
  const existingById = new Map<string, any>();
  existingRows.forEach((row: any) => {
    existingById.set(String(row._raw.remote_id), row);
  });

  await database.write(async () => {
    for (const center of centers) {
      const existing = existingById.get(center.id);
      if (existing) {
        await existing.update((record: any) => {
          applyReliefCenterToRecord(record, center);
        });
      } else {
        await collection.create((record: any) => {
          applyReliefCenterToRecord(record, center);
        });
      }
    }
  });
}

export async function getCachedIncidents(limit = 50): Promise<Incident[]> {
  if (!useWatermelon) {
    return Array.from(memoryIncidents.values())
      .sort(
        (a, b) =>
          new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime()
      )
      .slice(0, limit);
  }

  const collection = incidentsCollection();
  if (!collection) return [];
  const rows = await collection
    .query(Q.sortBy("last_reported_at", Q.desc), Q.take(limit))
    .fetch();
  return rows.map(incidentFromRecord);
}

export async function getCachedIncidentById(id: string): Promise<Incident | null> {
  if (!useWatermelon) {
    return memoryIncidents.get(id) ?? null;
  }

  const collection = incidentsCollection();
  if (!collection) return null;
  const rows = await collection.query(Q.where("remote_id", id), Q.take(1)).fetch();
  return rows[0] ? incidentFromRecord(rows[0]) : null;
}

export async function getCachedNearbyIncidents(
  latitude: number,
  longitude: number,
  radiusMeters = 50000
): Promise<Incident[]> {
  const all = await getCachedIncidents(300);
  return all
    .filter((incident) => {
      const meters = metersBetween(
        latitude,
        longitude,
        Number(incident.centroidLat),
        Number(incident.centroidLng)
      );
      return meters <= radiusMeters;
    })
    .sort(
      (a, b) =>
        new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime()
    );
}

export async function getCachedNearbyReliefCenters(
  latitude: number,
  longitude: number,
  radiusMeters = 30000
): Promise<ReliefCenter[]> {
  const rows = useWatermelon
    ? await reliefCentersCollection()
        ?.query(Q.sortBy("updated_at", Q.desc), Q.take(500))
        .fetch()
    : Array.from(memoryReliefCenters.values());

  if (!rows) return [];

  return (useWatermelon
    ? (rows as any[]).map((row: any) => reliefCenterFromRecord(row))
    : (rows as ReliefCenter[]))
    .map((center: ReliefCenter) => ({
      ...center,
      distance: metersBetween(
        latitude,
        longitude,
        Number(center.latitude),
        Number(center.longitude)
      ),
    }))
    .filter((center: ReliefCenter) => (center.distance ?? Infinity) <= radiusMeters)
    .sort(
      (a: ReliefCenter, b: ReliefCenter) =>
        (a.distance ?? Infinity) - (b.distance ?? Infinity)
    );
}

export async function refreshLatestIncidents(limit = 100): Promise<number> {
  const response = await listIncidentsApi({ limit });
  const incidents = response.data ?? [];
  await cacheIncidents(incidents);
  return incidents.length;
}

export async function refreshNearbyIncidents(
  latitude: number,
  longitude: number,
  radiusMeters = 50000
): Promise<number> {
  const response = await getNearbyIncidentsApi({
    latitude,
    longitude,
    radiusMeters,
  });
  const incidents = response.data ?? [];
  await cacheIncidents(incidents);
  return incidents.length;
}

export async function refreshNearbyReliefCenters(
  latitude: number,
  longitude: number,
  radiusMeters = 30000
): Promise<number> {
  const response = await getNearbyReliefCentersApi({
    latitude,
    longitude,
    radiusMeters,
  });
  const centers = response.data ?? [];
  await cacheReliefCenters(centers);
  return centers.length;
}

export async function refreshNearbySnapshot(
  latitude: number,
  longitude: number,
  radiusMeters = 30000
) {
  const [incidentCount, reliefCenterCount] = await Promise.all([
    refreshNearbyIncidents(latitude, longitude, Math.max(radiusMeters, 30000)),
    refreshNearbyReliefCenters(latitude, longitude, radiusMeters),
  ]);
  return { incidentCount, reliefCenterCount };
}

export async function updateCachedReliefCenter(
  id: string,
  patch: { status?: ReliefCenterStatus; currentCount?: number }
) {
  if (!useWatermelon) {
    const existing = memoryReliefCenters.get(id);
    if (!existing) return;
    memoryReliefCenters.set(id, {
      ...existing,
      status: patch.status ?? existing.status,
      currentCount:
        typeof patch.currentCount === "number"
          ? patch.currentCount
          : existing.currentCount,
    });
    return;
  }

  const collection = reliefCentersCollection();
  if (!collection || !database) return;
  const rows = await collection.query(Q.where("remote_id", id), Q.take(1)).fetch();
  const row = rows[0];
  if (!row) return;

  await database.write(async () => {
    await row.update((record: any) => {
      if (patch.status) record._raw.status = patch.status;
      if (typeof patch.currentCount === "number") {
        record._raw.current_count = patch.currentCount;
      }
      record._raw.updated_at = Date.now();
    });
  });
}

export async function bootstrapOfflineData() {
  try {
    await refreshLatestIncidents(100);
  } catch (err) {
    console.warn("[offline-db] bootstrap sync skipped:", err);
  }
}
