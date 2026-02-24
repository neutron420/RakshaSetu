import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  getIncidentByIdApi,
  getUpvoteInfoApi,
  toggleUpvoteApi,
  getIncidentMediaApi,
  Incident,
  SosCategory,
  IncidentPriority,
  IncidentStatus,
  UpvoteInfo,
  IncidentMedia,
} from '../../services/api';
import { Image } from 'expo-image';

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

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#FB8C00',
  INVESTIGATING: '#1E88E5',
  IN_PROGRESS: '#1A73E8',
  CONTAINED: '#7B1FA2',
  RESOLVED: '#43A047',
  CLOSED: '#757575',
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(dateStr: string) {
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

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [upvote, setUpvote] = useState<UpvoteInfo | null>(null);
  const [media, setMedia] = useState<IncidentMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [incRes, upRes, medRes] = await Promise.all([
          getIncidentByIdApi(id),
          getUpvoteInfoApi(id),
          getIncidentMediaApi(id),
        ]);
        setIncident(incRes.data);
        setUpvote(upRes.data);
        setMedia(medRes.data || []);
      } catch (err: any) {
        console.error('Failed to load incident details:', err);
        setError(err.message || 'Failed to load incident details');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleUpvote() {
    if (!incident) return;

    // Optimistic toggle
    setUpvote(prev => prev ? {
      ...prev,
      userVoted: !prev.userVoted,
      count: prev.userVoted ? Math.max(0, prev.count - 1) : prev.count + 1
    } : null);

    try {
      const res = await toggleUpvoteApi(incident.id);
      setUpvote({
        incidentId: incident.id,
        userVoted: res.data.voted,
        count: res.data.count,
      });
    } catch (err) {
      console.error('Upvote failed:', err);
      // Revert is complex with concurrent clicks, but simple toggle back works for now
      setUpvote(prev => prev ? {
        ...prev,
        userVoted: !prev.userVoted,
        count: prev.userVoted ? Math.max(0, prev.count - 1) : prev.count + 1
      } : null);
    }
  }

  const handleShare = async () => {
    if (!incident) return;
    try {
      await Share.share({
        title: incident.title,
        message: `🚨 Emergency Alert: ${incident.title}\n\nType: ${incident.category}\nStatus: ${incident.status}\n\nStay alert with RakshaSetu.`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.loadingText}>Loading incident...</Text>
      </View>
    );
  }

  if (error || !incident) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <Ionicons name="cloud-offline" size={56} color="#9CABC2" />
        <Text style={styles.errorText}>{error || 'Incident not found'}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const cat = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.OTHER;
  const priorityColor = PRIORITY_COLORS[incident.priority] || '#757575';
  const statusColor = STATUS_COLORS[incident.status] || '#757575';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Floating Back Button */}
      <View style={styles.floatingHeader}>
        <Pressable
          style={({ pressed }) => [styles.floatingBackBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={20}
        >
          <Ionicons name="arrow-back" size={26} color="#1A2B4A" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category Header */}
        <View style={[styles.categoryHeader, { backgroundColor: cat.color + '12' }]}>
          <View style={[styles.categoryIcon, { backgroundColor: cat.color + '22' }]}>
            <Ionicons name={cat.icon} size={36} color={cat.color} />
          </View>
          <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(incident.createdAt)}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{incident.title}</Text>

        {/* Tags */}
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: priorityColor + '18' }]}>
            <Ionicons name="flag" size={14} color={priorityColor} />
            <Text style={[styles.tagText, { color: priorityColor }]}>{incident.priority}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.tagText, { color: statusColor }]}>
              {incident.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Community Engagement */}
        <View style={styles.engagementRow}>
          <Pressable
            style={[styles.upvoteButton, upvote?.userVoted && styles.upvoteActive]}
            onPress={handleUpvote}
          >
            <Ionicons
              name={upvote?.userVoted ? 'arrow-up' : 'arrow-up-outline'}
              size={20}
              color={upvote?.userVoted ? '#1A73E8' : '#7A8BA8'}
            />
            <Text style={[styles.upvoteText, upvote?.userVoted && styles.upvoteActiveText]}>
              {upvote?.count || 0} Upvotes
            </Text>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color="#7A8BA8" />
            <Text style={styles.shareText}>Share Alert</Text>
          </Pressable>
        </View>

        {/* Media Gallery */}
        {media.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={18} color="#7A8BA8" />
              <Text style={styles.cardLabel}>Evidence & Media</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {media.map((item) => (
                <View key={item.id} style={styles.mediaWrapper}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.mediaItem}
                    contentFit="cover"
                  />
                  {item.mediaType === 'VIDEO' && (
                    <View style={styles.playIcon}>
                      <Ionicons name="play" size={24} color="#fff" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Description */}
        {incident.description && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={18} color="#7A8BA8" />
              <Text style={styles.cardLabel}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>{incident.description}</Text>
          </View>
        )}

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={18} color="#7A8BA8" />
            <Text style={styles.cardLabel}>Location</Text>
          </View>
          <View style={styles.locationGrid}>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Latitude</Text>
              <Text style={styles.locationValue}>{incident.centroidLat.toFixed(6)}</Text>
            </View>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Longitude</Text>
              <Text style={styles.locationValue}>{incident.centroidLng.toFixed(6)}</Text>
            </View>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Cluster Radius</Text>
              <Text style={styles.locationValue}>
                {incident.clusterRadiusMeters >= 1000
                  ? `${(incident.clusterRadiusMeters / 1000).toFixed(1)} km`
                  : `${Math.round(incident.clusterRadiusMeters)} m`}
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color="#7A8BA8" />
            <Text style={styles.cardLabel}>Timeline</Text>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Reported</Text>
              <Text style={styles.timelineValue}>{formatDateTime(incident.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.timelineLine} />
          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: '#43A047' }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Last Updated</Text>
              <Text style={styles.timelineValue}>{formatDateTime(incident.updatedAt)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  center: {
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
  engagementRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  upvoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
  },
  upvoteActive: {
    backgroundColor: '#E3F0FF',
    borderColor: '#1A73E8',
  },
  upvoteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  upvoteActiveText: {
    color: '#1A73E8',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A8BA8',
  },
  mediaScroll: {
    marginTop: 8,
  },
  mediaWrapper: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F7FF',
  },
  mediaItem: {
    width: '100%',
    height: '100%',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#7A8BA8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  floatingHeader: {
    position: 'absolute',
    top: 56,
    left: 20,
    zIndex: 10,
  },
  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  categoryHeader: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
  },
  categoryIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeAgo: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2B4A',
    letterSpacing: -0.3,
    marginBottom: 14,
    lineHeight: 32,
  },
  tags: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A8BA8',
    letterSpacing: 0.3,
  },
  descriptionText: {
    fontSize: 15,
    color: '#1A2B4A',
    lineHeight: 24,
    fontWeight: '500',
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  locationItem: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 12,
  },
  locationLabel: {
    fontSize: 11,
    color: '#9CABC2',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  locationValue: {
    fontSize: 15,
    color: '#1A2B4A',
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E2ECF5',
    marginLeft: 5,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 12,
    color: '#9CABC2',
    fontWeight: '600',
  },
  timelineValue: {
    fontSize: 14,
    color: '#1A2B4A',
    fontWeight: '600',
    marginTop: 2,
  },
});
