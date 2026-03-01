import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { ReliefCenter, ReliefCenterType, ReliefCenterStatus, Incident, fetchAutomatedReliefCentersApi } from '../../services/api';
import { socketService } from '../../services/socket';
import {
  getCachedNearbyIncidents,
  getCachedNearbyReliefCenters,
  refreshNearbySnapshot,
  updateCachedReliefCenter,
} from '../../services/offline-data';

const TYPE_CONFIG: Record<ReliefCenterType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  SHELTER: { icon: 'home', color: '#1A73E8', label: 'Shelter' },
  HOSPITAL: { icon: 'medkit', color: '#E53935', label: 'Hospital' },
  FOOD_CENTER: { icon: 'fast-food', color: '#FB8C00', label: 'Food' },
  OTHER: { icon: 'help-circle', color: '#757575', label: 'Other' },
};

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function ExploreScreen() {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [centers, setCenters] = useState<ReliefCenter[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState<ReliefCenter | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [fetchingAutomated, setFetchingAutomated] = useState(false);

  // Dispatch Tracking
  const [responderLoc, setResponderLoc] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isDispatchActive, setIsDispatchActive] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        setUserCoord({ latitude: lat, longitude: lng });
        setRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        fetchData(lat, lng);
      } catch (err) {
        console.error('Location error:', err);
      } finally {
        setLoading(false);
      }
    })();

    const unsubscribe = socketService.on('relief-center:update', (payload: { id: string; status?: ReliefCenterStatus; currentCount?: number }) => {
      void updateCachedReliefCenter(payload.id, {
        status: payload.status,
        currentCount: payload.currentCount,
      });
      setCenters(prev => prev.map(c => c.id === payload.id ? { ...c, status: payload.status ?? c.status, currentCount: payload.currentCount ?? c.currentCount } as ReliefCenter : c));
    });

    const offDispatchAccept = socketService.on('DISPATCH_ACCEPTED', (payload: any) => {
      setIsDispatchActive(true);
      Alert.alert('Help is on the way!', 'A volunteer has accepted your dispatch request. They are now visible on the map.');
      if (socketService.socket?.readyState === WebSocket.OPEN) {
        socketService.socket.send(JSON.stringify({
          type: 'location:subscribe',
          payload: { targetUserId: payload.responderId }
        }));
      }
    });

    const offLocUpdate = socketService.on('location:update', (payload: any) => {
      if (isDispatchActive) {
        setResponderLoc({
          latitude: payload.latitude,
          longitude: payload.longitude
        });
      }
    });

    return () => {
      unsubscribe();
      offDispatchAccept();
      offLocUpdate();
    }
  }, [isDispatchActive]);

  async function fetchData(lat: number, lng: number) {
    let cachedCenters: ReliefCenter[] = [];
    let cachedIncidents: Incident[] = [];
    try {
      [cachedCenters, cachedIncidents] = await Promise.all([
        getCachedNearbyReliefCenters(lat, lng, 30000),
        getCachedNearbyIncidents(lat, lng, 30000),
      ]);

      if (cachedCenters.length > 0) setCenters(cachedCenters);
      if (cachedIncidents.length > 0) setIncidents(cachedIncidents);

      await refreshNearbySnapshot(lat, lng, 30000);

      const [latestCenters, latestIncidents] = await Promise.all([
        getCachedNearbyReliefCenters(lat, lng, 30000),
        getCachedNearbyIncidents(lat, lng, 30000),
      ]);
      setCenters(latestCenters);
      setIncidents(latestIncidents);
    } catch (err) {
      console.error('Fetch data error:', err);
      if (cachedCenters.length === 0) setCenters([]);
      if (cachedIncidents.length === 0) setIncidents([]);
    }
  }

  async function handleFetchAutomated() {
    if (!userCoord) return;
    try {
      setFetchingAutomated(true);
      const res = await fetchAutomatedReliefCentersApi({
        latitude: userCoord.latitude,
        longitude: userCoord.longitude,
        radiusMeters: 30000
      });
      console.log('Automated fetch result:', res.data);
      // Refresh the map data to show new centers
      await fetchData(userCoord.latitude, userCoord.longitude);
    } catch (err) {
      console.error('Automated fetch error:', err);
      alert('Failed to fetch automated centers');
    } finally {
      setFetchingAutomated(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Relief center markers */}
        {centers.map(center => {
          const config = TYPE_CONFIG[center.type] || TYPE_CONFIG.OTHER;
          return (
            <Marker
              key={center.id}
              coordinate={{ latitude: Number(center.latitude), longitude: Number(center.longitude) }}
              onPress={() => {
                setSelectedIncident(null);
                setSelectedCenter(center);
              }}
              pinColor={config.color}
            >
              <View style={[styles.marker, { backgroundColor: config.color }]}>
                <Ionicons name={config.icon} size={16} color="#fff" />
              </View>
            </Marker>
          );
        })}

        {/* Incident markers */}
        {incidents.map(incident => {
          return (
            <Marker
              key={incident.id}
              coordinate={{ latitude: Number(incident.centroidLat), longitude: Number(incident.centroidLng) }}
              onPress={() => {
                setSelectedCenter(null);
                setSelectedIncident(incident);
              }}
              pinColor="#ce1515"
            >
              <View style={[styles.marker, { backgroundColor: '#ce1515' }]}>
                <Ionicons name="warning" size={16} color="#fff" />
              </View>
            </Marker>
          );
        })}

        {isDispatchActive && responderLoc && (
           <Marker
            coordinate={responderLoc}
            pinColor="#34C759"
            zIndex={999}
           >
             <View style={[styles.marker, { backgroundColor: '#34C759', borderColor: '#fff', borderWidth: 3 }]}>
                <Ionicons name="medical" size={16} color="#fff" />
              </View>
           </Marker>
        )}
      </MapView>

      {/* Detail Overlay */}
      {selectedCenter && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={[styles.typeBadge, { backgroundColor: (TYPE_CONFIG[selectedCenter.type] || TYPE_CONFIG.OTHER).color + '15' }]}>
              <Ionicons name={(TYPE_CONFIG[selectedCenter.type] || TYPE_CONFIG.OTHER).icon} size={16} color={(TYPE_CONFIG[selectedCenter.type] || TYPE_CONFIG.OTHER).color} />
              <Text style={[styles.typeText, { color: (TYPE_CONFIG[selectedCenter.type] || TYPE_CONFIG.OTHER).color }]}>
                {(TYPE_CONFIG[selectedCenter.type] || TYPE_CONFIG.OTHER).label}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedCenter(null)}>
              <Ionicons name="close" size={24} color="#9CABC2" />
            </Pressable>
          </View>

          <Text style={styles.centerName}>{selectedCenter.name}</Text>
          <Text style={styles.centerAddress}>{selectedCenter.address || 'Location provided on map'}</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: selectedCenter.status === 'OPEN' ? '#E8F5E9' : '#FFEBEE' }]}>
              <Text style={[styles.statusText, { color: selectedCenter.status === 'OPEN' ? '#43A047' : '#D32F2F' }]}>
                {selectedCenter.status}
              </Text>
            </View>
            {selectedCenter.maxCapacity != null && (
              <Text style={styles.occupancyText}>
                {selectedCenter.currentCount ?? 0} / {selectedCenter.maxCapacity} Occupied
              </Text>
            )}
          </View>

          <Pressable style={styles.directionsBtn}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </Pressable>
        </View>
      )}

      {selectedIncident && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={[styles.typeBadge, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="warning" size={16} color="#ce1515" />
              <Text style={[styles.typeText, { color: '#ce1515' }]}>
                {selectedIncident.category}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedIncident(null)}>
              <Ionicons name="close" size={24} color="#9CABC2" />
            </Pressable>
          </View>

          <Text style={styles.centerName}>{selectedIncident.title}</Text>
          <Text style={styles.centerAddress} numberOfLines={2}>
            {selectedIncident.description || 'No description available'}
          </Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: selectedIncident.status === 'OPEN' ? '#FFEBEE' : '#FFF3E0' }]}>
              <Text style={[styles.statusText, { color: selectedIncident.status === 'OPEN' ? '#ce1515' : '#E65100' }]}>
                {selectedIncident.status}
              </Text>
            </View>
            <Text style={styles.occupancyText}>
              {selectedIncident.reportCount} Reports
            </Text>
          </View>

          <Pressable style={[styles.directionsBtn, { backgroundColor: '#ce1515' }]}>
            <Ionicons name="eye" size={18} color="#fff" />
            <Text style={styles.directionsBtnText}>View Updates</Text>
          </Pressable>
        </View>
      )}

      {/* Floating Header */}
      <View style={styles.floatingHeader}>
        <View>
          <Text style={styles.headerTitle}>Relief Centers</Text>
          <Text style={styles.headerSubtitle}>Nearby shelters & hospitals (30km)</Text>
        </View>
        <Pressable 
          style={styles.fetchButton} 
          onPress={handleFetchAutomated}
          disabled={fetchingAutomated}
        >
          {fetchingAutomated ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-download" size={16} color="#fff" />
              <Text style={styles.fetchButtonText}>Fetch</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'android' && { minHeight: 400 }),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  floatingHeader: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fetchButton: {
    backgroundColor: '#1A73E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  fetchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 2,
  },
  detailCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  centerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  centerAddress: {
    fontSize: 14,
    color: '#7A8BA8',
    marginBottom: 16,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  occupancyText: {
    fontSize: 13,
    color: '#5A7A9A',
    fontWeight: '600',
  },
  directionsBtn: {
    backgroundColor: '#1A73E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  directionsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
