import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  createSosApi,
  SosCategory,
  getUploadUrlApi,
  addMediaApi,
  uploadFileToR2,
  MediaType,
} from '../services/api';

const CATEGORIES: { key: SosCategory; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { key: 'FLOOD', icon: 'water', label: 'Flood', color: '#1E88E5' },
  { key: 'FIRE', icon: 'flame', label: 'Fire', color: '#E53935' },
  { key: 'EARTHQUAKE', icon: 'earth', label: 'Earthquake', color: '#8D6E63' },
  { key: 'ACCIDENT', icon: 'car', label: 'Accident', color: '#FB8C00' },
  { key: 'MEDICAL', icon: 'medkit', label: 'Medical', color: '#E53935' },
  { key: 'VIOLENCE', icon: 'warning', label: 'Violence', color: '#D32F2F' },
  { key: 'LANDSLIDE', icon: 'trail-sign', label: 'Landslide', color: '#6D4C41' },
  { key: 'CYCLONE', icon: 'thunderstorm', label: 'Cyclone', color: '#5E35B1' },
  { key: 'OTHER', icon: 'help-circle', label: 'Other', color: '#757575' },
];

type SelectedMedia = {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
};

export default function ReportIncidentScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<SosCategory | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<SelectedMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const [addressDetails, setAddressDetails] = useState<string | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);

  // Floating animation for header icon
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Get location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Location is required to report an incident accurately');
          setLocLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        Alert.alert('Location Error', 'Could not get your location. Please enable GPS.');
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  async function fetchAddressDetails() {
    if (!location) return;
    setFetchingAddress(true);
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude: location.lat,
        longitude: location.lng,
      });

      if (result && result.length > 0) {
        const place = result[0];
        // e.g. "Anna Nagar, Chennai, Tamil Nadu, 600040"
        const parts = [
          place.name,          // usually building or immediate area (e.g. Anna Nagar)
          place.city || place.district,   // city or district
          place.region,        // state
          place.postalCode     // pincode
        ].filter(Boolean);     // filter out nulls

        if (parts.length > 0) {
          setAddressDetails(parts.join(', '));
        } else {
          Alert.alert('Notice', 'Could not find details for this specific location.');
        }
      } else {
        Alert.alert('Notice', 'No address details found.');
      }
    } catch (err: any) {
      console.error('[geocoding] error', err);
      Alert.alert('Error', 'Could not fetch area details. Please check your connection.');
    } finally {
      setFetchingAddress(false);
    }
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - mediaFiles.length,
      });

      if (!result.canceled && result.assets) {
        const newMedia: SelectedMedia[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video',
          mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        }));
        setMediaFiles((prev) => [...prev, ...newMedia].slice(0, 5));
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not open media picker');
    }
  }

  async function capturePhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setMediaFiles((prev) => [
          ...prev,
          {
            uri: asset.uri,
            type: 'image' as const,
            mimeType: asset.mimeType || 'image/jpeg',
          },
        ].slice(0, 5));
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not open camera');
    }
  }

  function removeMedia(index: number) {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadMedia(reportId: string) {
    console.log(`[media] Starting upload for report ${reportId}, count: ${mediaFiles.length}`);
    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      setUploadProgress(`Uploading evidence ${i + 1}/${mediaFiles.length}...`);

      try {
        console.log(`[media] Getting upload URL for file ${i + 1} (${file.mimeType})...`);
        const uploadRes = await getUploadUrlApi(file.mimeType);
        const { url: presignedUrl, key } = uploadRes.data;
        console.log(`[media] Got key: ${key}`);

        console.log(`[media] Uploading file to R2...`);
        await uploadFileToR2(presignedUrl, file.uri, file.mimeType);
        console.log(`[media] R2 upload success`);

        const mediaType: MediaType = file.type === 'video' ? 'VIDEO' : 'IMAGE';
        console.log(`[media] Registering with backend...`);
        await addMediaApi(reportId, { mediaType, url: key });
        console.log(`[media] Backend registration success`);
      } catch (err: any) {
        console.error(`[media] Failed to upload media ${i + 1}:`, err);
        Alert.alert('Upload Error', `Failed to upload file ${i + 1}. The report was submitted, but some media might be missing.`);
      }
    }
    setUploadProgress('');
  }

  async function handleSubmit() {
    if (!selectedCategory) {
      Alert.alert('Select Category', 'Please select a category for the incident');
      return;
    }
    if (!location) {
      Alert.alert('No Location', 'Location is required to map the incident.');
      return;
    }

    setLoading(true);
    try {
      // Reuses createSosApi since it automatically creates/links incidents
      let finalDescription = description.trim();
      if (addressDetails) {
        finalDescription += `\n\nLocation Context:\n${addressDetails}`;
      }

      const res = await createSosApi({
        category: selectedCategory,
        description: finalDescription || undefined,
        latitude: location.lat,
        longitude: location.lng,
      });

      if (mediaFiles.length > 0 && res.data?.reportId) {
        await uploadMedia(res.data.reportId);
      }

      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <View style={styles.successIcon}>
          <Ionicons name="megaphone" size={80} color="#1A73E8" />
        </View>
        <Text style={styles.successTitle}>Report Submitted!</Text>
        <Text style={styles.successText}>
          Thank you for alerting the community. Your report has been pinned to the map and added to the community feed.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A2B4A" />
        </Pressable>
        <Text style={styles.navTitle}>Report Incident</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
            <Ionicons name="business" size={48} color="#1A73E8" />
          </Animated.View>
          <Text style={styles.title}>Community Alert</Text>
          <Text style={styles.subtitle}>Help others stay safe by reporting hazards</Text>
        </View>

        {/* Location Status */}
        <View style={styles.locSection}>
          <View style={styles.locRow}>
            {locLoading ? (
              <>
                <ActivityIndicator size="small" color="#1A73E8" />
                <Text style={styles.locText}>Detecting location...</Text>
              </>
            ) : location ? (
              <>
                <Ionicons name="location" size={18} color="#1A73E8" />
                <Text style={[styles.locText, { color: '#1A73E8' }]}>
                  Mapped to ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={18} color="#D32F2F" />
                <Text style={[styles.locText, { color: '#D32F2F' }]}>Location not detected</Text>
              </>
            )}
          </View>

          {location && (
            <View style={styles.addressWrapper}>
              {addressDetails ? (
                <View style={styles.addressBox}>
                  <Ionicons name="map" size={16} color="#475569" style={{ marginTop: 2 }} />
                  <Text style={styles.addressText}>{addressDetails}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={fetchAddressDetails}
                  disabled={fetchingAddress}
                  style={({ pressed }) => [
                    styles.fetchAddrBtn,
                    pressed && { opacity: 0.8 },
                    fetchingAddress && { opacity: 0.5 }
                  ]}
                >
                  {fetchingAddress ? (
                    <ActivityIndicator size="small" color="#1A73E8" />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color="#1A73E8" />
                      <Text style={styles.fetchAddrText}>Fetch Details & Pincode</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Category Grid */}
        <Text style={styles.sectionLabel}>Incident Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[
                  styles.categoryCard,
                  isSelected && { borderColor: '#1A73E8', backgroundColor: '#1A73E810' },
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <Text style={[styles.catLabel, isSelected && { color: '#1A73E8', fontWeight: '700' }]}>
                  {cat.label}
                </Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: '#1A73E8' }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.sectionLabel}>What's happening?</Text>
        <View style={styles.textAreaWrapper}>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the situation for the community..."
            placeholderTextColor="#A0B0C4"
            multiline
            numberOfLines={4}
            maxLength={2000}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* Media Attachment */}
        <Text style={styles.sectionLabel}>Photos & Videos</Text>
        <View style={styles.mediaSection}>
          {mediaFiles.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaThumbs}>
              {mediaFiles.map((file, index) => (
                <View key={index} style={styles.thumbContainer}>
                  <Image source={{ uri: file.uri }} style={styles.thumb} />
                  {file.type === 'video' && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={24} color="#fff" />
                    </View>
                  )}
                  <Pressable style={styles.removeBtn} onPress={() => removeMedia(index)}>
                    <Ionicons name="close-circle" size={22} color="#D32F2F" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.mediaButtons}>
            <Pressable style={styles.mediaBtn} onPress={pickImage} disabled={mediaFiles.length >= 5}>
              <Ionicons name="images" size={20} color="#1A73E8" />
              <Text style={styles.mediaBtnText}>Library</Text>
            </Pressable>
            <Pressable style={styles.mediaBtn} onPress={capturePhoto} disabled={mediaFiles.length >= 5}>
              <Ionicons name="camera" size={20} color="#1A73E8" />
              <Text style={styles.mediaBtnText}>Camera</Text>
            </Pressable>
          </View>
        </View>

        {/* Submit Button */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            (!selectedCategory || loading) && styles.submitBtnDisabled,
            pressed && styles.submitBtnPressed,
          ]}
          onPress={handleSubmit}
          disabled={loading || !selectedCategory}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="megaphone" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>SUBMIT REPORT</Text>
            </>
          )}
        </Pressable>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A73E8',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
  },
  locSection: {
    marginBottom: 30,
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    padding: 12,
  },
  locText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addressWrapper: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1E8FF',
    paddingTop: 10,
    alignItems: 'center',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
  },
  addressText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 18,
  },
  fetchAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#EBF5FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A73E8',
  },
  fetchAddrText: {
    color: '#1A73E8',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  categoryCard: {
    width: '30.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F1F5F9',
    position: 'relative',
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  checkBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  textAreaWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 28,
  },
  textArea: {
    padding: 16,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 120,
  },
  mediaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 32,
  },
  mediaThumbs: {
    marginBottom: 14,
  },
  thumbContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 10,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  mediaBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    backgroundColor: '#1A73E8',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 10,
  },
  successText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  primaryBtn: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
