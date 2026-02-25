
import { prisma } from "../../common/db/prisma";
import { broadcastToRole, sendToUser } from "../../ws";

export async function alertNearbyUsers(params: {
  incidentId: string;
  category: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radius = params.radiusMeters ?? 2000; // 2km default
  console.log(`[alerts] Finding users within ${radius}m of (${params.latitude}, ${params.longitude})`);

  try {
    // Find users with a last known location within the radius
    const nearbyUsers = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"::text as "id"
      FROM "User"
      WHERE "lastLocationGeo" IS NOT NULL
        AND ST_DWithin(
          "lastLocationGeo",
          ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography,
          ${radius}
        )
    `;

    console.log(`[alerts] Found ${nearbyUsers.length} nearby users to alert.`);

    const alertMessage = {
      type: "emergency:proximity",
      payload: {
        incidentId: params.incidentId,
        category: params.category,
        message: `🚨 EMERGENCY: A ${params.category.toLowerCase()} has been reported near your location!`,
        latitude: params.latitude,
        longitude: params.longitude,
      }
    };

    // Send to each nearby user
    nearbyUsers.forEach(user => {
      sendToUser(user.id, alertMessage);
    });

  } catch (err: any) {
    console.error(`[alerts] Failed to alert nearby users: ${err.message}`);
  }
}
