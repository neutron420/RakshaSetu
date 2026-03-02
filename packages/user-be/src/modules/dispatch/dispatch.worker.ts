import { runConsumer, TOPICS } from "@rakshasetu/kafka";
import { prisma } from "../../common/db/prisma";
import { sendNotificationToUsers } from "../../common/services/notification.service";
import { sendToUser } from "../../ws";
import { getUserLatestLocation } from "../../ws/location.service";

// This runs continuously in the background to find available volunteers
export async function startDispatchWorker() {
  const maxRetries = 20;
  let retries = 0;

  while (true) {
    try {
      const consumer = await runConsumer(
        "volunteer-dispatch-group",
        [TOPICS.DISPATCH_REQUEST],
        async ({ message }) => {
          const value = JSON.parse(message.value?.toString() ?? "{}");
          const { incidentId, category, latitude, longitude, requiredSkills } = value.payload || {};

          if (!incidentId || !latitude || !longitude) {
            console.warn("[dispatch-worker] Missing location or incidentId data");
            return;
          }

          console.log(`[dispatch-worker] Processing dispatch for incident: ${incidentId}`);

          try {
            // Find volunteers within 2km (2000 meters)
            const searchRadiusMeters = 2000;

            // This PostGIS query explicitly searches for isVolunteer = true
            const nearbyVolunteers = await prisma.$queryRaw<{ id: string }[]>`
              SELECT "id"::text as "id"
              FROM "User"
              WHERE "isActive" = true
                AND "isVolunteer" = true
                AND "lastLocationGeo" IS NOT NULL
                AND ST_DWithin(
                  "lastLocationGeo",
                  ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                  ${searchRadiusMeters}
                )
              LIMIT 5;
            `;

            console.log(`[dispatch-worker] Found ${nearbyVolunteers.length} available volunteers within ${searchRadiusMeters}m`);

            if (nearbyVolunteers.length > 0) {
              const volunteerIds = nearbyVolunteers.map(v => v.id);

              await sendNotificationToUsers(
                volunteerIds,
                "🚨 VOLUNTEER REQUEST",
                `There is a critical ${category || "emergency"} nearby. Can you respond?`,
                {
                  type: "VOLUNTEER_DISPATCH",
                  incidentId,
                  category,
                  location: { lat: latitude, lng: longitude }
                }
              );

              // Also send via WebSocket for real-time in-app pop-up
              for (const volunteerId of volunteerIds) {
                sendToUser(volunteerId, {
                  type: "VOLUNTEER_DISPATCH",
                  payload: {
                    incidentId,
                    category,
                    latitude,
                    longitude
                  }
                });
              }

              console.log(`[dispatch-worker] Sent dispatch requests to: [${volunteerIds.join(", ")}]`);
            }
          } catch (err) {
            console.error("[dispatch-worker] Error querying for volunteers:", err);
          }
        }
      );

      retries = 0;
      console.log("[dispatch-worker] Kafka consumer connected and running.");

      await new Promise((resolve) => {
        consumer.on(consumer.events.CRASH, (e: any) => {
          console.error(`[dispatch-worker] Consumer crashed: ${e.payload.error.message}`);
          resolve(null);
        });
        consumer.on(consumer.events.DISCONNECT, () => resolve(null));
        consumer.on(consumer.events.STOP, () => resolve(null));
      });

      console.warn("[dispatch-worker] Connection lost. Preparation for restart...");
      await new Promise(res => setTimeout(res, 5000));
    } catch (err: any) {
      retries++;
      if (err.message.includes("coordinator")) {
        console.warn(`[dispatch-worker] Kafka coordinator warming up (attempt ${retries}/${maxRetries}).`);
      } else {
        console.error(`[dispatch-worker] Kafka error:`, err.message);
      }

      if (retries >= maxRetries) break;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}
