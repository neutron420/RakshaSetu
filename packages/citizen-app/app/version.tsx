import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AppVersionScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color="#1A2B4A" />
        </Pressable>
        <Text style={styles.headerTitle}>App Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.branding}>
          {/* A simple placeholder logo using Ionicons */}
          <View style={styles.logoBox}>
            <Ionicons name="shield-checkmark" size={64} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>RakshaSetu</Text>
          <View style={styles.betaBadge}>
             <Text style={styles.betaText}>Beta Phase</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>v1.0.0-beta.4</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Build Number</Text>
            <Text style={styles.infoValue}>10042</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Release Date</Text>
            <Text style={styles.infoValue}>October 2026</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>React Native (Expo)</Text>
          </View>
        </View>

        <View style={styles.changelog}>
          <Text style={styles.changelogTitle}>What's new in v1.0.0</Text>
          <View style={styles.clItem}>
            <Text style={styles.clBullet}>•</Text>
            <Text style={styles.clText}>Added interactive Danger Zones Heatmap powered by Mapbox integration.</Text>
          </View>
          <View style={styles.clItem}>
            <Text style={styles.clBullet}>•</Text>
            <Text style={styles.clText}>Implemented automatic Reverse Geocoding for accurate pincode reporting.</Text>
          </View>
          <View style={styles.clItem}>
            <Text style={styles.clBullet}>•</Text>
            <Text style={styles.clText}>Fully redesigned sleek Settings tab with expanded translation preferences.</Text>
          </View>
          <View style={styles.clItem}>
            <Text style={styles.clBullet}>•</Text>
            <Text style={styles.clText}>Automated ingestion of OpenWeather events into community SOS feed.</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2ECF5',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A2B4A',
    letterSpacing: -0.5,
  },
  betaBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFECB3',
    marginTop: 8,
  },
  betaText: {
    color: '#FF8F00',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: '#7A8BA8',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#1A2B4A',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F4F8',
  },
  changelog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  changelogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 16,
  },
  clItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clBullet: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '900',
    marginRight: 10,
    lineHeight: 22,
  },
  clText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#4A5568',
  }
});
