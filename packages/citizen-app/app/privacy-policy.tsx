import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>RakshaSetu Privacy Policy</Text>
        <Text style={styles.date}>Last Updated: October 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Data We Collect</Text>
          <Text style={styles.text}>
            We collect your location, emergency contact information, and incident reporting data solely for the purpose of personal and community safety. Your accurate GPS location is required to provide real-time Danger Zone alerts and route emergency responders effectively.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Data</Text>
          <Text style={styles.text}>
            Your data is used to coordinate disaster response, aggregate regional crisis heatmaps, and dispatch help. We do not sell your personal data to third parties. Anonymized data may be shared with government agencies for disaster preparedness.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Media Uploads</Text>
          <Text style={styles.text}>
            Images and videos uploaded during an SOS report are securely stored on Cloudflare R2 and are only visible to responders and verified community users to assess the severity of the situation. 
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Complete Document</Text>
          <Text style={styles.text}>
            This is a summary. For the full legal privacy policy documentation, please contact our support team.
          </Text>
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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 6,
  },
  date: {
    fontSize: 14,
    color: '#7A8BA8',
    fontWeight: '500',
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 24,
  }
});
