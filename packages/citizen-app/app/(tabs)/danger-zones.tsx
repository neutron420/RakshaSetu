import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import MapView, { Heatmap, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Incident, getNearbyIncidentsApi } from '../../services/api';
import { socketService } from '../../services/socket';

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function DangerZonesScreen() {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

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
        fetchIncidents(lat, lng);
      } catch (err) {
        console.error('Location error:', err);
      } finally {
        setLoading(false);
      }
    })();

    const unsubscribe = socketService.on('incident:new', (incident: Incident) => {
      setIncidents(prev => [incident, ...prev]);
    });

    return () => unsubscribe();
  }, []);

  async function fetchIncidents(lat: number, lng: number) {
    try {
      const resIncidents = await getNearbyIncidentsApi({ latitude: lat, longitude: lng, radiusMeters: 50000 });
      setIncidents(resIncidents.data || []);
    } catch (err) {
      console.error('Fetch incidents error:', err);
      setIncidents([]);
    }
  }

  // Convert incidents to Heatmap points
  const heatmapPoints = incidents.map(incident => ({
    latitude: Number(incident.centroidLat),
    longitude: Number(incident.centroidLng),
    weight: incident.severity === 'CRITICAL' ? 3 : incident.severity === 'HIGH' ? 2 : 1,
  }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ce1515" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Floating Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flame" size={24} color="#ce1515" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Danger Zones</Text>
          <Text style={styles.headerSubtitle}>Heatmap of concentrated incidents</Text>
        </View>
      </View>

      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
        userInterfaceStyle="dark" // Provides a darker map on iOS
        customMapStyle={darkMapStyle} // Custom dark mode for Android
      >
        {heatmapPoints.length > 0 && (
           <Heatmap
             points={heatmapPoints}
             radius={50}
             opacity={0.8}
             gradient={{
               colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'],
               startPoints: [0.01, 0.25, 0.50, 0.75, 1],
               colorMapSize: 200
             }}
           />
        )}
      </MapView>

      {/* Info Card at Bottom */}
      <View style={styles.bottomCard}>
        <Text style={styles.bottomCardText}>
          <Text style={{fontWeight: 'bold', color: '#ce1515'}}>{incidents.length}</Text> severe incidents located in your region.
        </Text>
        <Text style={styles.bottomCardSub}>Red areas indicate critical danger zones based on frequency and severity of recent SOS reports.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(206, 21, 21, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ECEFF1',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#90A4AE',
    fontWeight: '500',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.9)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomCardText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  bottomCardSub: {
    color: '#90A4AE',
    fontSize: 13,
    lineHeight: 18,
  }
});

// A standard dark map style string for Google Maps (React Native Maps Android)
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#181818"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1b1b1b"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];
