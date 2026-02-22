import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, RelativePathString } from 'expo-router';
import { hasValidSession } from '../services/auth-store';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    hasValidSession()
      .then((valid) => setIsLoggedIn(valid))
      .catch(() => setIsLoggedIn(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  // If logged in with valid session → go straight to home
  if (isLoggedIn) {
    return <Redirect href={'/(tabs)' as RelativePathString} />;
  }

  // Otherwise → show splash/login flow
  return <Redirect href={'/splash' as RelativePathString} />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
