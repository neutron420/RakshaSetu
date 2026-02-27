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
import { useRouter } from 'expo-router';
import {
  toggleUpvoteApi,
  batchGetUpvotesApi,
  Incident,
  SosCategory,
  IncidentPriority,
  UpvoteInfo,
} from '../../services/api';
import { socketService } from '../../services/socket';
import EmergencyCallSheet from '../../components/EmergencyCallSheet';
import { Image } from 'expo-image';
import { Share } from 'react-native';
import { getCachedIncidents, refreshLatestIncidents } from '../../services/offline-data';

const CATEGORY_CONFIG: Record<SosCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  FLOOD: { icon: 'water', color: '#1E88E5', label: 'Flood' },
  FIRE: { icon: 'flame', color: '#E53935', label: 'Fire' },
  EARTHQUAKE: { icon: 'earth', color: '#8D6E63', label: 'Earthquake' },
  ACCIDENT: { icon: 'car', color: '#FB8C00', label: 'Accident' },
  MEDICAL: { icon: 'medkit', color: '#E53935', label: 'Medical' },
  VIOLENCE: { icon: 'warning', color: '#D32F2F', label: 'Violence' },
  LANDSLIDE: { icon: 'trail-sign', color: '#6D4C41', label: 'Landslide' },
  CYCLONE: { icon: 'thunderstorm', color: '#5E35B1', label: 'Cyclone' },
  OTHER: { icon: 'help-circle', color: '#757575', label: 'Other' },
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

type UpvoteMap = Record<string, { count: number; userVoted: boolean }>;

export default function CommunityScreen() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [upvotes, setUpvotes] = useState<UpvoteMap>({});
  const [callSheetVisible, setCallSheetVisible] = useState(false);

  const fetchIncidents = useCallback(async () => {
    let items: Incident[] = [];
    try {
      setError('');
      items = await getCachedIncidents(50);
      if (items.length > 0) {
        setIncidents(items);
      }
      await refreshLatestIncidents(120);
      items = await getCachedIncidents(50);
      setIncidents(items);

      // Fetch upvote data for all loaded incidents
      if (items.length > 0) {
        try {
          const ids = items.map((i) => i.id);
          const upvoteRes = await batchGetUpvotesApi(ids);
          const map: UpvoteMap = {};
          (upvoteRes.data || []).forEach((info: UpvoteInfo) => {
            map[info.incidentId] = { count: info.count, userVoted: info.userVoted };
          });
          setUpvotes(map);
        } catch {
          // Upvote fetch failed silently — not critical
        }
      }
    } catch (err: any) {
      if (items.length === 0) {
        setError(err.message || 'Failed to load community alerts');
      }
    }
  }, []);

  useEffect(() => {
    fetchIncidents().finally(() => setLoading(false));

    // Connect to WebSocket on mount
    socketService.connect();

    // Listen for incident updates
    const unsubscribe = socketService.on('incident:update', () => {
      console.log('[Community] Incident update received, refreshing...');
      fetchIncidents();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchIncidents();
    setRefreshing(false);
  }, [fetchIncidents]);

  async function handleUpvote(incidentId: string) {
    // Optimistic update
    setUpvotes((prev) => {
      const existing = prev[incidentId] || { count: 0, userVoted: false };
      return {
        ...prev,
        [incidentId]: {
          userVoted: !existing.userVoted,
          count: existing.userVoted
            ? Math.max(0, existing.count - 1)
            : existing.count + 1,
        },
      };
    });

    try {
      const res = await toggleUpvoteApi(incidentId);
      // Sync with server response
      setUpvotes((prev) => ({
        ...prev,
        [incidentId]: {
          userVoted: res.data.voted,
          count: res.data.count,
        },
      }));
    } catch {
      // Revert optimistic update on failure
      setUpvotes((prev) => {
        const existing = prev[incidentId] || { count: 0, userVoted: false };
        return {
          ...prev,
          [incidentId]: {
            userVoted: !existing.userVoted,
            count: existing.userVoted
              ? Math.max(0, existing.count - 1)
              : existing.count + 1,
          },
        };
      });
    }
  }

  const handleShare = async (incident: Incident) => {
    try {
      await Share.share({
        title: incident.title,
        message: `🚨 Emergency Alert: ${incident.title}\n\nType: ${incident.category}\nStatus: ${incident.status}\n\nKeep safe with RakshaSetu.`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  function renderIncident({ item }: { item: Incident }) {
    const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OTHER;
    const priorityColor = PRIORITY_COLORS[item.priority] || '#757575';
    const upvoteInfo = upvotes[item.id] || { count: 0, userVoted: false };

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/incident/${item.id}` as any)}
      >
        {/* Category icon */}
        <View style={[styles.categoryBadge, { backgroundColor: cat.color + '15' }]}>
          <Ionicons name={cat.icon} size={24} color={cat.color} />
        </View>

        {/* Image Preview (Optional) */}
        {item.representativeMediaUrl && (
          <Image
            source={{ uri: item.representativeMediaUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        )}

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {item.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Meta tags */}
          <View style={styles.cardMeta}>
            <View style={[styles.tag, { backgroundColor: cat.color + '12' }]}>
              <Text style={[styles.tagText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: priorityColor + '12' }]}>
              <Ionicons name="flag" size={10} color={priorityColor} />
              <Text style={[styles.tagText, { color: priorityColor }]}>
                {item.priority}
              </Text>
            </View>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>

        {/* Action Column */}
        <View style={styles.actionColumn}>
          {/* Upvote button */}
          <Pressable
            style={[
              styles.upvoteBtn,
              upvoteInfo.userVoted && styles.upvoteBtnActive,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleUpvote(item.id);
            }}
            hitSlop={8}
          >
            <Ionicons
              name={upvoteInfo.userVoted ? 'arrow-up' : 'arrow-up-outline'}
              size={20}
              color={upvoteInfo.userVoted ? '#1A73E8' : '#9CABC2'}
            />
            {upvoteInfo.count > 0 && (
              <Text
                style={[
                  styles.upvoteCount,
                  upvoteInfo.userVoted && styles.upvoteCountActive,
                ]}
              >
                {upvoteInfo.count}
              </Text>
            )}
          </Pressable>

          {/* Share button */}
          <Pressable
            style={styles.shareBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleShare(item);
            }}
            hitSlop={8}
          >
            <Ionicons name="share-social-outline" size={18} color="#9CABC2" />
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people" size={28} color="#1A73E8" />
          <View>
            <Text style={styles.headerTitle}>Community Alerts</Text>
            <Text style={styles.headerSubtitle}>
              {incidents.length} active emergencies
            </Text>
          </View>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="shield-checkmark" size={28} color="#1A73E8" />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Loading community alerts...</Text>
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
          <Text style={styles.emptyText}>
            No active emergencies in the community right now
          </Text>
        </View>
      ) : (
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
      )}

      {/* Emergency Call FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setCallSheetVisible(true)}
      >
        <Ionicons name="call" size={26} color="#fff" />
      </Pressable>

      {/* Bottom Sheet */}
      <EmergencyCallSheet
        visible={callSheetVisible}
        onClose={() => setCallSheetVisible(false)}
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A2B4A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 2,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#F8FBFF',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F0F7FF',
  },
  categoryBadge: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2B4A',
    lineHeight: 21,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#7A8BA8',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 11,
    color: '#9CABC2',
    fontWeight: '500',
  },
  upvoteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#F5F8FC',
    alignSelf: 'flex-start',
    minWidth: 40,
  },
  upvoteBtnActive: {
    backgroundColor: '#E3F0FF',
  },
  upvoteCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CABC2',
    marginTop: 2,
  },
  upvoteCountActive: {
    color: '#1A73E8',
  },
  actionColumn: {
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F8FC',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B71C1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabPressed: {
    backgroundColor: '#B71C1C',
    transform: [{ scale: 0.92 }],
  },
});
