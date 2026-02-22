import { useState, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { listMySosReportsApi, SosReport, SosCategory } from '../../services/api';

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

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#FB8C00',
  ACKNOWLEDGED: '#1E88E5',
  IN_PROGRESS: '#1A73E8',
  RESOLVED: '#43A047',
  CLOSED: '#757575',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyReportsScreen() {
  const [reports, setReports] = useState<SosReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    try {
      setError('');
      const res = await listMySosReportsApi();
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    }
  }, []);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchReports().finally(() => setLoading(false));
    }, [fetchReports])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

  function renderReport({ item }: { item: SosReport }) {
    const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.OTHER;
    const statusColor = STATUS_COLORS[item.status] || '#757575';

    return (
      <View style={styles.card}>
        <View style={[styles.categoryBadge, { backgroundColor: cat.color + '18' }]}>
          <Ionicons name={cat.icon} size={24} color={cat.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text style={styles.cardCategory}>{cat.label}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.cardFooter}>
            <Ionicons name="time-outline" size={14} color="#9CABC2" />
            <Text style={styles.cardTime}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="document-text" size={28} color="#1A73E8" />
        <Text style={styles.title}>My Reports</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={48} color="#9CABC2" />
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={56} color="#D8E4F0" />
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptyText}>
            Your SOS reports will appear here after you submit one
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
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
    alignItems: 'center',
    gap: 10,
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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    gap: 14,
  },
  categoryBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardDesc: {
    fontSize: 13,
    color: '#7A8BA8',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
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
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
