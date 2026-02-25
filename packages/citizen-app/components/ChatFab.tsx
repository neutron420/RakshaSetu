import React from 'react';
import { StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export function ChatFab() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'light';

  // Hide the FAB on these specific screens so it doesn't block the UI
  const hiddenOnPaths = [
    '/chatbot', 
    '/settings', 
    '/login', 
    '/signup', 
    '/splash',
    '/sos',
    '/danger-zones'
  ];

  // Also hide on incident details screens since they have their own specific layouts
  if (hiddenOnPaths.includes(pathname) || pathname.startsWith('/incident/')) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors[colorScheme].tint }]}
        onPress={() => router.push('/(tabs)/chatbot')}
        activeOpacity={0.8}
      >
        <Image 
          source={require('@/assets/images/rakshasetu.png')} 
          style={styles.logoIcon}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Above the tab bar
    left: 20,
    zIndex: 9999, // Ensure it stays on top of everything
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  logoIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
});
