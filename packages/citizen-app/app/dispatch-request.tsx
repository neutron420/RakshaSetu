import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BASE_URL } from '../services/api';
import { getToken } from '../services/auth-store';

export default function DispatchRequestScreen() {
  const router = useRouter();
  const { incidentId, category, distance } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  async function handleResponse(status: 'ACCEPTED' | 'DECLINED') {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/dispatch/${incidentId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to respond to dispatch');

      if (status === 'ACCEPTED') {
        Alert.alert("Dispatch Accepted", "Thank you for volunteering. Navigating to emergency.", [
          { text: "OK", onPress: () => router.replace(`/incident/${incidentId}`) }
        ]);
      } else {
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Red Alert Header Overlay */}
      <View style={styles.redOverlay}>
        <Ionicons name="medical" size={64} color="#FFFFFF" style={styles.pulseIcon} />
        <Text style={styles.urgentTitle}>URGENT ASSISTANCE</Text>
        <Text style={styles.subtitle}>A nearby user has requested volunteer support.</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.categoryLabel}>Incident Type</Text>
        <Text style={styles.categoryValue}>{category || 'CRITICAL EMERGENCY'}</Text>
        
        <View style={styles.distanceBadge}>
          <Ionicons name="location" size={16} color="#D32F2F" />
          <Text style={styles.distanceText}>{distance || '2.4'} km away</Text>
        </View>

        <Text style={styles.promptText}>Can you respond to this location right now?</Text>
      </View>

      <View style={styles.actionContainer}>
        <Pressable 
          style={({pressed}) => [styles.declineBtn, pressed && {opacity: 0.7}]}
          onPress={() => handleResponse('DECLINED')}
          disabled={loading}
        >
          <Text style={styles.declineText}>I CANNOT HELP</Text>
        </Pressable>

        <Pressable 
          style={({pressed}) => [styles.acceptBtn, pressed && {opacity: 0.8}]}
          onPress={() => handleResponse('ACCEPTED')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptText}>YES, I WILL GO</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  redOverlay: {
    backgroundColor: '#D32F2F',
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  pulseIcon: {
    marginBottom: 16,
  },
  urgentTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#FFCDD2',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  detailsCard: {
    margin: 24,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginBottom: 24,
  },
  distanceText: {
    color: '#D32F2F',
    fontWeight: '800',
    fontSize: 15,
  },
  promptText: {
    fontSize: 18,
    color: '#E5E5EA',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 16,
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 50,
  },
  acceptBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  acceptText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  declineBtn: {
    backgroundColor: '#3A3A3C',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#AEAEB2',
  }
});
