import { AppError } from "../../common/utils/app-error";
import type { CreateReliefCenterInput } from "./relief-centers.schema";

const MAPBOX_TOKEN = "pk.eyJ1Ijoicml0ZXNoc2luZ2gyMDA0IiwiYSI6ImNta2lteXV3YzBzZ3gzY3NhNG5yY2U2am0ifQ.K103v784nScl561odn6lzA";
const MAPBOX_API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function fetchReliefCentersFromMapbox(
  lat: number,
  lng: number,
  radiusMeters: number = 30000 // Mapbox sorts by proximity, explicit strict radius isn't easily enforced via this API
): Promise<CreateReliefCenterInput[]> {
  const centers: CreateReliefCenterInput[] = [];
  const queries = ["hospital", "clinic", "shelter", "community center"];

  try {
    for (const q of queries) {
      const url = `${MAPBOX_API_URL}/${encodeURIComponent(q)}.json?proximity=${lng},${lat}&access_token=${MAPBOX_TOKEN}&limit=20`;
      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text();
        console.error(`[Mapbox] API error response for '${q}': ${text}`);
        continue; // Skip to next query instead of failing completely if one errors
      }

      const data = await response.json();
      const features = data.features || [];

      for (const feature of features) {
        if (!feature.center || feature.center.length !== 2) continue;

        const [featureLng, featureLat] = feature.center;
        
        // Determine type based on query or category property
        let type: "HOSPITAL" | "SHELTER" | "FOOD_CENTER" | "OTHER" = "OTHER";
        const categoryStr = feature.properties?.category?.toLowerCase() || q;
        if (categoryStr.includes("hospital") || categoryStr.includes("clinic") || q === "hospital" || q === "clinic") {
          type = "HOSPITAL";
        } else if (categoryStr.includes("shelter") || categoryStr.includes("community") || q === "shelter") {
          type = "SHELTER";
        }

        const name = feature.text || "Unnamed Facility";
        // Mapbox place_name often contains the full string; strip the local name out for a cleaner address
        const address = feature.place_name?.replace(`${name}, `, "") || undefined;

        centers.push({
          name: name.substring(0, 180),
          type,
          status: "OPEN",
          description: `Source: Mapbox POI (${q})`,
          address,
          latitude: Number(featureLat),
          longitude: Number(featureLng),
          // Mapbox Geocoding doesn't reliably provide phones, leave undefined
        });
      }
    }

    return centers;
  } catch (error) {
    console.error("Error fetching from Mapbox:", error);
    throw new AppError("Failed to fetch data from Mapbox", 500);
  }
}
