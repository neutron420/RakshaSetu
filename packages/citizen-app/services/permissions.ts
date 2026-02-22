import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Request foreground location (GPS) permission.
 * Shows an alert guiding the user to settings if denied.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') return true;

  Alert.alert(
    'Location Permission Required',
    'RakshaSetu needs your location to report emergencies accurately and send help to your area. Please enable location in settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/**
 * Request camera permission.
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === 'granted') return true;

  Alert.alert(
    'Camera Permission Required',
    'RakshaSetu needs camera access so you can capture photos and videos of emergencies to attach with your SOS reports.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/**
 * Request media library / photo library permission.
 * Uses expo-image-picker which only needs photo/video access (no AUDIO permission).
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;

  Alert.alert(
    'Media Access Required',
    'RakshaSetu needs access to your photos and files so you can attach evidence to your SOS reports.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/**
 * Request all permissions in sequence: Location → Camera → Media Library.
 * Call this once after login when the user reaches the main tab screen.
 */
export async function requestAllPermissions(): Promise<void> {
  // Location is the most critical for an emergency app
  await requestLocationPermission();

  // Camera for capturing emergency evidence
  await requestCameraPermission();

  // Media library for selecting existing photos/videos
  await requestMediaLibraryPermission();
}
