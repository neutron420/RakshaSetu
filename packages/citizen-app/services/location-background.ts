import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { patchMeApi, listIncidentsApi } from './api';
import { socketService } from './socket';
import { getToken } from './auth-store';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[background-location] Task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;
      
      console.log(`[background-location] Updating location: ${latitude}, ${longitude}`);
      
      try {
        await patchMeApi({
          latitude,
          longitude
        });
        const ws = socketService.socket;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({

            type: "location:update",
            payload: {
              latitude,
              longitude,
              speed: location.coords.speed || 0,
              heading: location.coords.heading || 0
            }
          }));
        }

      } catch (err) {
        console.warn('[background-location] Failed to update location on backend:', err);
      }
    }
  }
});

export async function startBackgroundLocationUpdates() {
  const token = await getToken();
  if (!token) {
    console.log('[background-location] Not logged in, skipping.');
    return;
  }
  const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

  if (foregroundStatus !== 'granted' || backgroundStatus !== 'granted') {
    console.warn('[background-location] Permissions not granted');
    return;
  }

  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isStarted) {
    console.log('[background-location] Task already running');
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 500, // Update every 500 meters to save battery
    deferredUpdatesInterval: 60000, // Defer for 1 minute
    foregroundService: {
      notificationTitle: 'RakshaSetu is active',
      notificationBody: 'Protecting you with real-time early warnings.',
      notificationColor: '#1A73E8',
    },
  });
  
  console.log('[background-location] Background updates started');
}

/**
 * Stop the background location tracking.
 */
export async function stopBackgroundLocationUpdates() {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[background-location] Background updates stopped');
  }
}

// ─── GEOFENCING ALERTS ───
const GEOFENCE_TASK_NAME = 'incident-geofence-task';

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data: { eventType, region }, error }: any) => {
  if (error) {
    console.error('[geofence-task] Error:', error);
    return;
  }
  if (eventType === Location.GeofencingEventType.Enter) {
    console.log(`🚨 [geofence-task] ENTERED incident zone:`, region.identifier);
    // Trigger existing frontend listener via local socket event bypass
    socketService.emitLocal('EMERGENCY_ALERT', {
      type: 'Danger Zone',
      location: `Near an active incident`,
      severity: 'high'
    });
  } else if (eventType === Location.GeofencingEventType.Exit) {
    console.log(`[geofence-task] EXITED incident zone:`, region.identifier);
  }
});

/**
 * Fetch open incidents and monitor them via background geofencing.
 */
export async function startIncidentGeofencing() {
  const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
  const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

  if (foregroundStatus !== 'granted' || backgroundStatus !== 'granted') {
    console.warn('[geofence-api] Permissions not granted');
    return;
  }

  const token = await getToken();
  if (!token) {
    console.log('[geofence-api] Not logged in, skipping.');
    return;
  }

  try {
    // 1. Fetch active open incidents
    const res = await listIncidentsApi({ status: 'OPEN' });
    const activeIncidents = res.data;

    if (activeIncidents.length === 0) {
      console.log('[geofence-api] No active incidents to geofence.');
      return;
    }

    // 2. Map into expo-location GeofenceRegions (e.g. 1km radius)
    const regions: Location.LocationRegion[] = activeIncidents.map(inc => ({
      identifier: inc.id,
      latitude: inc.centroidLat,
      longitude: inc.centroidLng,
      radius: 1000, // 1000 meters = 1km radius
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    // 3. Start Geofencing Task
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
    console.log(`[geofence-api] Started tracking ${regions.length} active incidents.`);
  } catch (err: any) {
    console.warn('[geofence-api] Geofencing unavailable:', err?.message || err);
  }
}
