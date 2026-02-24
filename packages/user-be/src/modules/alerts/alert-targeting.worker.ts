import { runConsumer, TOPICS } from "@rakshasetu/kafka";
import { prisma } from "../../common/db/prisma";
import { sendNotificationToUsers } from "../../common/services/notification.service";

export async function startAlertTargetingWorker() {
  const maxRetries = 20; // Increased for better patience
  let retries = 0;

  while (true) { // Infinite loop for self-healing
    try {
      const consumer = await runConsumer(
        "alert-targeting-group",
        [TOPICS.NATURAL_DISASTER_ALERT],
        async ({ message }) => {
          const value = JSON.parse(message.value?.toString() ?? "{}");
      const { payload, aggregateId } = value;

      if (!payload || !payload.latitude || !payload.longitude) {
        console.warn("[alert-worker] Received disaster event with missing location data");
        return;
      }

      console.log(`[alert-worker] Processing disaster: ${payload.title}`);

      try {

        const radiusMeters = (payload.magnitude ?? 5) * 20000; 
        
        // 1. Check if an incident already exists for this exact disaster event ID
        // (to prevent duplicates if Kafka replays the message)
        const existingIncident = await prisma.incident.findUnique({
          where: { id: aggregateId } // Using aggregateId as the Incident ID
        });
        
        if (!existingIncident) {
          console.log(`[alert-worker] Creating Incident record for weather event: ${aggregateId}`);
          
          let category: "FLOOD" | "FIRE" | "EARTHQUAKE" | "ACCIDENT" | "MEDICAL" | "VIOLENCE" | "LANDSLIDE" | "CYCLONE" | "OTHER" = "OTHER";
          const titleLower = (payload.title || "").toLowerCase();
          
          if (titleLower.includes("rain") || titleLower.includes("flood") || titleLower.includes("thunderstorm") || titleLower.includes("squall")) {
            category = "FLOOD";
          } else if (titleLower.includes("fire")) {
            category = "FIRE";
          } else if (titleLower.includes("earthquake")) {
            category = "EARTHQUAKE";
          } else if (titleLower.includes("cyclone") || titleLower.includes("hurricane") || titleLower.includes("tornado")) {
            category = "CYCLONE";
          } else if (titleLower.includes("landslide")) {
             category = "LANDSLIDE";
          }

          const severityMapping = payload.severity === 'red' ? 'CRITICAL' : payload.severity === 'orange' ? 'HIGH' : payload.severity === 'yellow' ? 'MEDIUM' : 'LOW';

          // Use raw query for the PostGIS centroidGeo insertion
          await prisma.$executeRaw`
            INSERT INTO "Incident" (
              "id", 
              "category", 
              "status", 
              "priority", 
              "title", 
              "description", 
              "centroidLat", 
              "centroidLng", 
              "centroidGeo", 
              "firstReportedAt", 
              "lastReportedAt", 
              "createdAt", 
              "updatedAt"
            ) VALUES (
              ${aggregateId}::uuid, 
              ${category}::"SosCategory", 
              'OPEN'::"IncidentStatus", 
              ${severityMapping}::"IncidentPriority", 
              ${payload.title}, 
              ${payload.description || 'Automated weather alert'}, 
              ${payload.latitude}, 
              ${payload.longitude}, 
              ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography,
              NOW(), 
              NOW(), 
              NOW(), 
              NOW()
            )
            ON CONFLICT ("id") DO NOTHING;
          `;
        } else {
             console.log(`[alert-worker] Incident already exists for ${aggregateId}, skipping creation.`);
        }

        const impactedUsers = await prisma.$queryRaw<{ id: string }[]>`
          SELECT "id"::text as "id"
          FROM "User"
          WHERE "lastLocationGeo" IS NOT NULL
            AND ST_DWithin(
              "lastLocationGeo",
              ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography,
              ${radiusMeters}
            )
        `;

        console.log(`[alert-worker] Found ${impactedUsers.length} users in impact zone (${radiusMeters/1000}km).`);

        if (impactedUsers.length > 0) {
          const userIds = impactedUsers.map(u => u.id);
          
          await sendNotificationToUsers(
            userIds,
            "🚨 CRITICAL SAFETY ALERT",
            `A ${payload.title || 'Severe Event'} has been detected at ${payload.place || 'your area'}. Take immediate shelter if you are in a danger zone.`,
            {
              type: "NATURAL_DISASTER",
              disasterId: aggregateId,
              severity: payload.severity,
              location: { lat: payload.latitude, lng: payload.longitude }
            }
          );
          
          console.log(`[alert-worker] Targeted notifications sent to ${userIds.length} users.`);
        }
      } catch (err) {
        console.error("[alert-worker] Error targeting users for disaster alert:", err);
      }
    }
      );
      
      // Reset retries if we successfully connected
      retries = 0;
      console.log("[alert-worker] Kafka consumer connected and running.");

      // BLOCK here until the consumer crashes or stops.
      // This prevents starting multiple consumers in a loop.
      await new Promise((resolve) => {
        consumer.on(consumer.events.CRASH, (e: any) => {
          console.error(`[alert-worker] Consumer crashed: ${e.payload.error.message}`);
          resolve(null);
        });
        
        // As a backup, if it disconnects or stops without a crash event
        consumer.on(consumer.events.DISCONNECT, () => resolve(null));
        consumer.on(consumer.events.STOP, () => resolve(null));
      });

      console.warn("[alert-worker] Consumer connection lost. Preparation for restart...");
      await new Promise(res => setTimeout(res, 5000));
    } catch (err: any) {
      retries++;
      const isCoordinatorError = err.message.includes("coordinator") || err.name === "KafkaJSGroupCoordinatorNotFound";
      
      if (isCoordinatorError) {
        console.warn(`[alert-worker] Kafka coordinator still warming up (attempt ${retries}/${maxRetries}). Retrying in 5s...`);
      } else {
        console.error(`[alert-worker] Kafka error (attempt ${retries}/${maxRetries}):`, err.message);
      }

      if (retries >= maxRetries) {
        console.error("[alert-worker] Max retries reached following coordinator errors. Monitoring will be disabled until next manual restart.");
        break; // Stop after too many consecutive failures
      }

      await new Promise(res => setTimeout(res, 5000));
    }
  }
}
