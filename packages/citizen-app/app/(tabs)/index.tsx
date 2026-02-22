import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { listIncidentsApi, Incident, SosCategory, IncidentPriority } from '../../services/api';
import { getUser } from '../../services/auth-store';
import { socketService } from '../../services/socket';
import { Image } from 'expo-image';

const CATEGORY_CONFIG: Record<SosCategory, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  FLOOD: { icon: 'water', color: '#1E88E5' },
  FIRE: { icon: 'flame', color: '#E53935' },
  EARTHQUAKE: { icon: 'earth', color: '#8D6E63' },
  ACCIDENT: { icon: 'car', color: '#FB8C00' },
  MEDICAL: { icon: 'medkit', color: '#E53935' },
  VIOLENCE: { icon: 'warning', color: '#D32F2F' },
  LANDSLIDE: { icon: 'trail-sign', color: '#6D4C41' },
  CYCLONE: { icon: 'thunderstorm', color: '#5E35B1' },
  OTHER: { icon: 'help-circle', color: '#757575' },
};

const PRIORITY_COLORS: Record<IncidentPriority, string> = {
  LOW: '#43A047',
  MEDIUM: '#FB8C00',
  HIGH: '#E53935',
  CRITICAL: '#B71C1C',
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchIncidents = useCallback(async () => {
    try {
      setError('');
      const res = await listIncidentsApi({ limit: 20 });
      setIncidents(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load incidents');
    }
  }, []);

  const loadUser = useCallback(async () => {
    const user = await getUser();
    if (user?.fullName) {
      setUserName(user.fullName.split(' ')[0]);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchIncidents(), loadUser()]).finally(() => setLoading(false));

    // Connect to WebSocket on mount
    socketService.connect();

    // Listen for incident updates
    const unsubscribe = socketService.on('incident:update', () => {
      console.log('[Home] Incident update received, refreshing...');
      fetchIncidents();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchIncidents();
    }, [fetchIncidents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchIncidents();
    setRefreshing(false);
  }, [fetchIncidents]);

  function renderIncident({ item }: { item: Incident }) {
    const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OTHER;
    const priorityColor = PRIORITY_COLORS[item.priority] || '#757575';

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/incident/${item.id}` as any)}
      >
        <View style={[styles.categoryBadge, { backgroundColor: cat.color + '18' }]}>
          <Ionicons name={cat.icon} size={22} color={cat.color} />
        </View>

        {item.representativeMediaUrl && (
          <Image
            source={{ uri: item.representativeMediaUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        )}

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          
          {item.description && (
            <Text style={styles.cardDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}

          <View style={styles.cardMeta}>
            <View style={[styles.statusTag, { backgroundColor: priorityColor + '18' }]}>
              <Text style={[styles.statusText, { color: priorityColor }]}>
                {item.priority}
              </Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: '#1A73E818' }]}>
              <Text style={[styles.statusText, { color: '#1A73E8' }]}>
                {item.status.replace('_', ' ')}
              </Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: '#FFD70018' }]}>
              <Text style={[styles.statusText, { color: '#B8860B' }]}>
                {item.reportCount} Reports
              </Text>
            </View>
            <Text style={styles.timeText}>{formatTime(item.lastReportedAt)}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {userName || 'Citizen'} 👋</Text>
          <Text style={styles.headerSubtitle}>Stay safe with RakshaSetu</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="shield-checkmark" size={32} color="#1A73E8" />
        </View>
      </View>

      {/* Quick: Relief Centers Map */}
      <Pressable
        style={({ pressed }) => [styles.reliefCard, pressed && styles.reliefCardPressed]}
        onPress={() => router.push('/(tabs)/explore')}
      >
        <View style={styles.reliefCardIcon}>
          <Ionicons name="map" size={24} color="#1A73E8" />
        </View>
        <View style={styles.reliefCardText}>
          <Text style={styles.reliefCardTitle}>Relief Centers</Text>
          <Text style={styles.reliefCardSubtitle}>Shelters, hospitals & help nearby</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9CABC2" />
      </Pressable>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Ionicons name="pulse" size={20} color="#1A73E8" />
        <Text style={styles.sectionTitle}>Active Incidents</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Loading incidents...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={48} color="#9CABC2" />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : incidents.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={56} color="#43A047" />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyText}>No active incidents in your area</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={incidents}
            keyExtractor={(i) => i.id}
            renderItem={renderIncident}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1A73E8']}
                tintColor="#1A73E8"
              />
            }
          />

          {/* Floating Report Button */}
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => router.push('/report-incident')}
          >
            <Ionicons name="megaphone" size={24} color="#fff" />
            <Text style={styles.fabText}>Report</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A2B4A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 4,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reliefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 14,
  },
  reliefCardPressed: {
    backgroundColor: '#F8FBFF',
    transform: [{ scale: 0.99 }],
  },
  reliefCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reliefCardText: {
    flex: 1,
  },
  reliefCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  reliefCardSubtitle: {
    fontSize: 13,
    color: '#7A8BA8',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    gap: 14,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#F8FBFF',
  },
  categoryBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#F0F7FF',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 4,
    lineHeight: 20,
  },
  cardDescription: {
    fontSize: 13,
    color: '#7A8BA8',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 12,
    color: '#9CABC2',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#7A8BA8',
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A2B4A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#7A8BA8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1A73E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    gap: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#1557B0',
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
