import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { socketService } from '@/services/socket';
import { RedAlertModal } from '@/components/alerts/RedAlertModal';
import { startBackgroundLocationUpdates } from '@/services/location-background';
import { requestBlePermissions } from '@/services/ble-mesh/permissions';
import { startBackgroundBLEScanner, stopBLEScanner } from '@/services/ble-mesh/scanner';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  // Early Warning System (EWS) State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({
    type: 'Emergency',
    location: 'Nearby region',
    severity: 'critical'
  });

  useEffect(() => {
    // ── WebSocket Alert Listener (Works in Expo Go!) ──
    const handleAlert = (payload: any) => {
      console.log('🚨 [EWS] Received Emergency Alert via WebSocket:', payload);
      setAlertData({
        type: payload.disasterType || payload.type || 'Emergency',
        location: payload.location?.name || payload.location || 'Your Area',
        severity: payload.severity || 'critical'
      });
      setAlertVisible(true);
    };

    const handleOutboxAlert = (msg: any) => {
      console.log('🚨 [EWS] Received Outbox Alert:', msg);
      if (msg.payload?.data) {
        const data = msg.payload.data;
        setAlertData({
          type: data.alertType || data.title || 'Emergency',
          location: data.place || 'Your Area',
          severity: data.severity || 'critical'
        });
        setAlertVisible(true);
      }
    };

    const offEmergency = socketService.on('EMERGENCY_ALERT', handleAlert);
    const offLegacy = socketService.on('NATURAL_DISASTER', handleAlert);
    const offOutbox = socketService.on('outbox:NaturalDisasterAlert', handleOutboxAlert);

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (isExpoGo) {
      console.log('Skipping push notification and background location setup in Expo Go.');
      return () => {
        offEmergency();
        offLegacy();
      };
    }

    // Start background location tracking for EWS
    void startBackgroundLocationUpdates();

    // Start BLE Mesh Scanner — detect offline SOS beacons from nearby victims
    requestBlePermissions().then((granted) => {
      if (granted) {
        console.log('[BLE] Permissions granted, starting passive mesh scanner...');
        startBackgroundBLEScanner();
      } else {
        console.warn('[BLE] Permissions denied, mesh relay will not function.');
      }
    });

    // Listen for incoming notifications
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const { data } = notification.request.content;
      
      // Check if it's a Natural Disaster Alert from our EWS
      if (data && data.type === 'NATURAL_DISASTER') {
        const payload = data as any;
        setAlertData({
          type: payload.disasterType || 'Earthquake',
          location: payload.location?.name || 'Your Area',
          severity: payload.severity || 'high'
        });
        setAlertVisible(true);
      }
    });

    return () => {
      subscription.remove();
      offEmergency();
      offLegacy();
      offOutbox();
      stopBLEScanner();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="incident/[id]" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
      
      {/* Global Early Warning System Modal */}
      <RedAlertModal 
        visible={alertVisible}
        disasterType={alertData.type}
        location={alertData.location}
        severity={alertData.severity}
        onClose={() => setAlertVisible(false)}
      />
    </ThemeProvider>
  );
}
