import { enqueueEvent } from "../outbox/outbox.service";

interface UsgsFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    title: string;
    alert: string; // "green", "yellow", "orange", "red"
  };
  geometry: {
    coordinates: [number, number, number]; // [lng, lat, depth]
  };
}

/**
 * Polls the USGS Earthquake API for significant global events.
 * For production, this would be a scheduled task.
 */
export async function pollDisasterEvents() {
  try {
    const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson";
    const response = await fetch(url);
    const data = await response.json();

    const features: UsgsFeature[] = data.features || [];

    for (const feature of features) {
      // Only process earthquakes with a mag > 4.5 or classified as significant
      if (feature.properties.mag >= 4.5) {
        await enqueueEvent({
          aggregateType: "NaturalDisaster",
          aggregateId: feature.id,
          eventType: "NaturalDisasterAlert",
          partitionKey: feature.id,
          payload: {
            title: feature.properties.title,
            place: feature.properties.place,
            magnitude: feature.properties.mag,
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            severity: feature.properties.alert || "yellow",
            alertType: "EARTHQUAKE",
            happenedAt: new Date(feature.properties.time).toISOString(),
          },
        });
        console.log(`[EWS] Enqueued disaster alert: ${feature.properties.title}`);
      }
    }
  } catch (err) {
    console.error("[EWS] Failed to poll USGS events:", err);
  }
}
