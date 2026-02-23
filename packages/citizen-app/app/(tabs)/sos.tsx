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
import {
  createSosApi,
  SosCategory,
  getUploadUrlApi,
  addMediaApi,
  uploadFileToR2,
  MediaType,
} from '../../services/api';

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

export default function SosScreen() {
  const [selectedCategory, setSelectedCategory] = useState<SosCategory | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<SelectedMedia[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  // Pulse animation for SOS button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Get location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Location is required to report an emergency');
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
      setUploadProgress(`Uploading ${i + 1}/${mediaFiles.length}...`);

      try {
        // Get presigned URL
        console.log(`[media] Getting upload URL for file ${i + 1} (${file.mimeType})...`);
        const uploadRes = await getUploadUrlApi(file.mimeType);
        const { url: presignedUrl, key } = uploadRes.data;
        console.log(`[media] Got key: ${key}`);

        // Upload file to R2
        console.log(`[media] Uploading file to R2...`);
        await uploadFileToR2(presignedUrl, file.uri, file.mimeType);
        console.log(`[media] R2 upload success`);

        // Register media with backend
        const mediaType: MediaType = file.type === 'video' ? 'VIDEO' : 'IMAGE';
        console.log(`[media] Registering with backend...`);
        await addMediaApi(reportId, {
          mediaType,
          url: key,
        });
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
      Alert.alert('Select Category', 'Please select the type of emergency');
      return;
    }
    if (!location) {
      Alert.alert('No Location', 'GPS location is required. Please enable location services.');
      return;
    }

    setLoading(true);
    try {
      const res = await createSosApi({
        category: selectedCategory,
        description: description.trim() || undefined,
        latitude: location.lat,
        longitude: location.lng,
      });

      // Upload media if any
      if (mediaFiles.length > 0 && res.data?.reportId) {
        await uploadMedia(res.data.reportId);
      }

      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit SOS');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSubmitted(false);
    setSelectedCategory(null);
    setDescription('');
    setMediaFiles([]);
    setUploadProgress('');
  }

  if (submitted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="dark" />
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#43A047" />
        </View>
        <Text style={styles.successTitle}>SOS Sent!</Text>
        <Text style={styles.successText}>
          Your emergency report has been submitted{mediaFiles.length > 0 ? ' with media evidence' : ''}. Help is on the way. Stay safe!
        </Text>
        <Pressable
          style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
          onPress={handleReset}
        >
          <Text style={styles.resetBtnText}>Report Another Emergency</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="alert-circle" size={36} color="#D32F2F" />
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.subtitle}>Report an emergency in your area</Text>
        </View>

        {/* Location Status */}
        <View style={styles.locRow}>
          {locLoading ? (
            <>
              <ActivityIndicator size="small" color="#1A73E8" />
              <Text style={styles.locText}>Getting your location...</Text>
            </>
          ) : location ? (
            <>
              <Ionicons name="location" size={18} color="#43A047" />
              <Text style={[styles.locText, { color: '#43A047' }]}>
                Location acquired ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="location-outline" size={18} color="#D32F2F" />
              <Text style={[styles.locText, { color: '#D32F2F' }]}>Location not available</Text>
            </>
          )}
        </View>

        {/* Category Grid */}
        <Text style={styles.sectionLabel}>What's happening?</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[
                  styles.categoryCard,
                  isSelected && { borderColor: cat.color, backgroundColor: cat.color + '10' },
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <View style={[styles.catIcon, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <Text style={[styles.catLabel, isSelected && { color: cat.color, fontWeight: '700' }]}>
                  {cat.label}
                </Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.sectionLabel}>Details (optional)</Text>
        <View style={styles.textAreaWrapper}>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the situation..."
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
        <Text style={styles.sectionLabel}>Attach Evidence (optional)</Text>
        <View style={styles.mediaSection}>
          {/* Media Thumbnails */}
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
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeMedia(index)}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={22} color="#D32F2F" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Add buttons */}
          {mediaFiles.length < 5 && (
            <View style={styles.mediaButtons}>
              <Pressable
                style={({ pressed }) => [styles.mediaBtn, pressed && { opacity: 0.7 }]}
                onPress={pickImage}
              >
                <Ionicons name="images-outline" size={22} color="#1A73E8" />
                <Text style={styles.mediaBtnText}>Gallery</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.mediaBtn, pressed && { opacity: 0.7 }]}
                onPress={capturePhoto}
              >
                <Ionicons name="camera-outline" size={22} color="#1A73E8" />
                <Text style={styles.mediaBtnText}>Camera</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.mediaHint}>
            {mediaFiles.length}/5 files attached • Photos & videos accepted
          </Text>
        </View>

        {/* Upload Progress */}
        {uploadProgress ? (
          <View style={styles.uploadRow}>
            <ActivityIndicator size="small" color="#1A73E8" />
            <Text style={styles.uploadText}>{uploadProgress}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <Animated.View style={{ transform: [{ scale: selectedCategory ? pulseAnim : 1 }] }}>
          <Pressable
            style={({ pressed }) => [
              styles.sosButton,
              !selectedCategory && styles.sosButtonDisabled,
              pressed && selectedCategory && styles.sosButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading || !selectedCategory}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <Ionicons name="alert-circle" size={28} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.sosButtonText}>SEND SOS</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D32F2F',
    marginTop: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 4,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  locText: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 12,
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryCard: {
    width: '30.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2ECF5',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#5A7A9A',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAreaWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
    marginBottom: 24,
  },
  textArea: {
    padding: 16,
    fontSize: 15,
    color: '#1A2B4A',
    minHeight: 100,
    fontWeight: '500',
  },
  // Media attachment styles
  mediaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
    padding: 16,
    marginBottom: 28,
  },
  mediaThumbs: {
    marginBottom: 12,
  },
  thumbContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#E2ECF5',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#E8F2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C5DCFA',
    borderStyle: 'dashed',
  },
  mediaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  mediaHint: {
    fontSize: 12,
    color: '#9CABC2',
    textAlign: 'center',
    fontWeight: '500',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 14,
    color: '#1A73E8',
    fontWeight: '600',
  },
  sosButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B71C1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  sosButtonPressed: {
    backgroundColor: '#B71C1C',
    transform: [{ scale: 0.96 }],
  },
  sosButtonDisabled: {
    backgroundColor: '#BDBDBD',
    shadowOpacity: 0,
    elevation: 0,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#43A047',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: '#7A8BA8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  resetBtn: {
    backgroundColor: '#1A73E8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  resetBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
