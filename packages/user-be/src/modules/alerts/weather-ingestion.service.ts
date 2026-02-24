import crypto from "node:crypto";
import { prisma } from "../../common/db/prisma";
import { broadcast } from "../../ws";
import { enqueueEvent } from "../outbox/outbox.service";

export async function pollWeatherAlerts() {
  try {

    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      console.warn("[EWS] OPENWEATHER_API_KEY is not set. Skipping real-time poll.");
      return;
    }

    // Find all distinct user locations (rounded to 2 decimal places to group nearby users, ~1.1km radius)
    const locations = await prisma.$queryRaw<Array<{ lat: number, lon: number }>>`
      SELECT DISTINCT 
        ROUND("lastLat"::numeric, 2)::float as lat, 
        ROUND("lastLng"::numeric, 2)::float as lon
      FROM "User" 
      WHERE "lastLat" IS NOT NULL AND "lastLng" IS NOT NULL
    `;

    if (!locations || locations.length === 0) {
      console.log("[EWS] No active user locations found to poll weather for.");
      return;
    }

    console.log(`[EWS] Polling for severe weather events for ${locations.length} unique regions...`);

    for (const loc of locations) {
      const { lat, lon } = loc;
      try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        
        if (!response.ok) {
            console.error(`[EWS] Weather API failed for location ${lat},${lon}: ${response.statusText}`);
            continue;
        }
        
        const data = await response.json();
        const weather = data.weather?.[0];
        const alerts: any[] = [];

        // Trigger alert if weather condition is severe (Thunderstorm 2xx, Tornado 781, Squall 771)
        if (weather && (
            (weather.id >= 200 && weather.id < 300) || 
            weather.id === 781 || 
            weather.id === 771 || 
            weather.main.toLowerCase().includes("thunderstorm")
        )) {
            alerts.push({
                event: "SEVERE " + weather.main.toUpperCase(),
                sender_name: "OpenWeather",
                description: weather.description || "Severe weather conditions detected.",
                start: data.dt
            });
        }

        if (alerts.length > 0) {
            await processAlerts(alerts, lat, lon);
        }
      } catch (err) {
        console.error(`[EWS] Failed to poll for location ${lat},${lon}:`, err);
      }
    }

  } catch (err) {
    console.error("[EWS] Failed to poll weather alerts:", err);
  }
}

async function processAlerts(alerts: any[], lat: number, lon: number) {
  for (const alert of alerts) {
    // 1. Broadcast immediately for real-time UX
    broadcast({
      type: "EMERGENCY_ALERT",
      payload: {
        disasterType: alert.event.toUpperCase(),
        location: alert.sender_name || "Your Area",
        severity: "high", 
        description: alert.description
      }
    });

    // 2. Persist to outbox for Kafka and reliability
    await enqueueEvent({
      aggregateType: "NaturalDisaster",
      aggregateId: crypto.randomUUID(), // Must be a valid UUID
      eventType: "NaturalDisasterAlert",
      partitionKey: "weather",
      payload: {
        title: alert.event,
        place: alert.sender_name,
        description: alert.description,
        latitude: lat,
        longitude: lon,
        severity: "red",
        alertType: "WEATHER",
        happenedAt: new Date(alert.start * 1000).toISOString(),
      }
    });
    
    console.log(`[EWS] Processed weather alert: ${alert.event}`);
  }
}

