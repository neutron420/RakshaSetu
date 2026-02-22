
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { patchMeApi } from './api';

const isExpoGo = Constants.appOwnership === 'expo';

/** Lazily load expo-notifications — only outside Expo Go */
function getNotificationsModule() {
  return require('expo-notifications') as typeof import('expo-notifications');
}

// Configure notification handler (only outside Expo Go)
if (!isExpoGo) {
  const Notifications = getNotificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Registers the device for push notifications and sends the
 * Expo push token to the backend via PATCH /users/me.
 *
 * Returns null silently in Expo Go since push notifications
 * are not supported there since SDK 53.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications are not supported in Expo Go (SDK 53+)
  if (isExpoGo) {
    console.log('Push notifications are not supported in Expo Go. Use a development build.');
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const Notifications = getNotificationsModule();

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
      sound: 'default',
    });
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  try {
    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses the project ID from app.json automatically
    });
    const pushToken = tokenData.data;
    console.log('Expo Push Token:', pushToken);

    // Send the token to the backend
    await patchMeApi({ pushToken });
    console.log('Push token sent to backend');

    return pushToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}
