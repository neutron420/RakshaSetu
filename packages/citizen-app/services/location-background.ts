import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { patchMeApi } from './api';
import { socketService } from './socket';

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
        
        // Also fire off a quick WebSocket event for real-time dispatch tracking!
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
