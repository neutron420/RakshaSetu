import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { requestAllPermissions } from '../../services/permissions';
import { registerForPushNotificationsAsync } from '../../services/notifications';

export default function TabLayout() {
  useEffect(() => {
    // Request all permissions (location, camera, media) on app start
    requestAllPermissions().then(async (status) => {
      // After permissions, register for push notifications
      registerForPushNotificationsAsync();

      // Passive location sync for Proximity Alerts
      try {
        const loc = await require('expo-location').getCurrentPositionAsync({ accuracy: require('expo-location').Accuracy.Balanced });
        const { patchMeApi } = require('../../services/api');
        await patchMeApi({ 
          latitude: loc.coords.latitude, 
          longitude: loc.coords.longitude 
        });
        console.log('[Layout] Location synced for proximity alerts');
      } catch (err) {
        console.warn('[Layout] Failed to sync passive location:', err);
      }
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A73E8',
        tabBarInactiveTintColor: '#9CABC2',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#0D47A1',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-reports"
        options={{
          title: 'My Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

