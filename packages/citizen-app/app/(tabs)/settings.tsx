import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter, RelativePathString } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getMeApi, patchMeApi, UserProfile } from '../../services/api';
import { clearAuth, getUser } from '../../services/auth-store';

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Settings State
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Odia', 'Bengali'];

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await getMeApi();
      setProfile(res.data);
      setEditName(res.data.fullName);
      setEditPhone(res.data.phone || '');
      setIsVolunteer(!!res.data.isVolunteer);
    } catch (err: any) {
      // Fallback to cached user
      const cached = await getUser();
      if (cached) {
        setProfile({
          id: cached.id,
          email: cached.email,
          fullName: cached.fullName,
          phone: cached.phone,
          role: cached.role,
          isActive: true,
          isVolunteer: cached.isVolunteer,
          createdAt: '',
        });
        setEditName(cached.fullName);
        setEditPhone(cached.phone || '');
        setIsVolunteer(!!cached.isVolunteer);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await patchMeApi({
        fullName: editName.trim(),
        phone: editPhone.trim() || null,
      });
      setProfile(res.data);
      setEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleVolunteerToggle(value: boolean) {
    setIsVolunteer(value);
    try {
      await patchMeApi({ isVolunteer: value });
      Alert.alert(
        value ? 'Volunteer Mode Activated' : 'Volunteer Mode Off',
        value 
          ? 'You will now receive emergency dispatch requests if someone nearby needs help.'
          : 'You will no longer receive emergency dispatch requests.'
      );
    } catch (err: any) {
      setIsVolunteer(!value); // Revert on failure
      Alert.alert('Error', 'Failed to update volunteer status.');
    }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/login' as RelativePathString);
        },
      },
    ]);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Settings Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile ? getInitials(profile.fullName) : '?'}
                </Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={styles.name}>{profile?.fullName || 'Citizen'}</Text>
                <Text style={styles.email}>{profile?.email || 'No email'}</Text>
                <View style={styles.roleBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#1A73E8" />
                  <Text style={styles.roleText}>{profile?.role || 'CITIZEN'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />
            
            <View style={styles.cardHeader}>
              <Text style={styles.cardSubtitle}>Personal Details</Text>
              {!editing && (
                <Pressable onPress={() => setEditing(true)} hitSlop={10}>
                  <Ionicons name="create-outline" size={20} color="#1A73E8" />
                </Pressable>
              )}
            </View>

            {/* Full Name */}
            <View style={styles.field}>
              <View style={styles.fieldLabel}>
                <Ionicons name="person-outline" size={16} color="#7A8BA8" />
                <Text style={styles.fieldLabelText}>Full Name</Text>
              </View>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#A0B0C4"
                />
              ) : (
                <Text style={styles.fieldValue}>{profile?.fullName}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <View style={styles.fieldLabel}>
                <Ionicons name="call-outline" size={16} color="#7A8BA8" />
                <Text style={styles.fieldLabelText}>Phone</Text>
              </View>
              {editing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor="#A0B0C4"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.fieldValue}>{profile?.phone || 'Not set'}</Text>
              )}
            </View>

            {/* Save / Cancel buttons when editing */}
            {editing && (
              <View style={styles.editActions}>
                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    setEditing(false);
                    setEditName(profile?.fullName || '');
                    setEditPhone(profile?.phone || '');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            
            {/* Community Volunteer Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="medical" size={20} color="#2E7D32" />
                </View>
                <View>
                  <Text style={styles.settingRowTitle}>Community Volunteer</Text>
                  <Text style={{fontSize: 12, color: '#7A8BA8', marginTop: 2}}>Receive nearby SOS dispatch requests</Text>
                </View>
              </View>
              <Switch
                value={isVolunteer}
                onValueChange={handleVolunteerToggle}
                trackColor={{ false: '#CFD8E3', true: '#AED581' }}
                thumbColor={isVolunteer ? '#7CB342' : '#f4f3f4'}
              />
            </View>

            <View style={styles.divider} />
            
            {/* Language Selection */}
            <Pressable 
              style={styles.settingRow} 
              onPress={() => setShowLanguageModal(!showLanguageModal)}
            >
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="language" size={20} color="#2E7D32" />
                </View>
                <Text style={styles.settingRowTitle}>Language Translation</Text>
              </View>
              <View style={styles.settingRowRight}>
                <Text style={styles.settingValue}>{selectedLanguage}</Text>
                <Ionicons name={showLanguageModal ? "chevron-up" : "chevron-down"} size={20} color="#CFD8E3" />
              </View>
            </Pressable>

            {showLanguageModal && (
              <View style={styles.languageOptions}>
                {languages.map((lang) => (
                  <Pressable
                    key={lang}
                    style={[
                      styles.langOption,
                      selectedLanguage === lang && styles.langOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedLanguage(lang);
                      setShowLanguageModal(false);
                      Alert.alert('Language Updated', `Translation preference set to ${lang}.`);
                    }}
                  >
                    <Text style={[
                      styles.langText,
                      selectedLanguage === lang && styles.langTextSelected
                    ]}>{lang}</Text>
                    {selectedLanguage === lang && (
                       <Ionicons name="checkmark-circle" size={18} color="#1A73E8" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.divider} />

            {/* Notifications Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="notifications" size={20} color="#E65100" />
                </View>
                <Text style={styles.settingRowTitle}>Push Notifications</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#CFD8E3', true: '#AED581' }}
                thumbColor={pushEnabled ? '#7CB342' : '#f4f3f4'}
              />
            </View>

            <View style={styles.divider} />

            {/* Dark Mode Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#EDE7F6' }]}>
                  <Ionicons name="moon" size={20} color="#4527A0" />
                </View>
                <Text style={styles.settingRowTitle}>Dark Mode</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#CFD8E3', true: '#B39DDB' }}
                thumbColor={darkMode ? '#7E57C2' : '#f4f3f4'}
              />
            </View>

          </View>
        </View>

        {/* Resources & About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            
            <Pressable style={styles.settingRow} onPress={() => router.push('/privacy-policy' as RelativePathString)}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="lock-closed" size={20} color="#6A1B9A" />
                </View>
                <Text style={styles.settingRowTitle}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CFD8E3" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.settingRow} onPress={() => router.push('/terms-of-service' as RelativePathString)}>
              <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#E0F7FA' }]}>
                  <Ionicons name="document-text" size={20} color="#006064" />
                </View>
                <Text style={styles.settingRowTitle}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CFD8E3" />
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.settingRow} onPress={() => router.push('/version' as RelativePathString)}>
               <View style={styles.settingRowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="information-circle" size={20} color="#1565C0" />
                </View>
                <Text style={styles.settingRowTitle}>RakshaSetu Version</Text>
              </View>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>Beta v1.0.0</Text>
              </View>
            </Pressable>

          </View>
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#D32F2F" />
          <Text style={styles.logoutText}>Logout of RakshaSetu</Text>
        </Pressable>
        
        <View style={styles.footerBranding}>
            <Text style={styles.footerText}>Made with ❤️ for Citizen Safety</Text>
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
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2ECF5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7A8BA8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 24,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  avatarInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '500',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A73E8',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F4F8',
    marginVertical: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fieldLabelText: {
    fontSize: 13,
    color: '#7A8BA8',
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 15,
    color: '#1A2B4A',
    fontWeight: '600',
    paddingLeft: 22,
  },
  fieldInput: {
    fontSize: 15,
    color: '#1A2B4A',
    fontWeight: '500',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
    marginLeft: 22,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D8E4F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A8BA8',
  },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1A73E8',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2B4A',
  },
  settingRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  languageOptions: {
    marginTop: 12,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 8,
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  langOptionSelected: {
    backgroundColor: '#E8F2FF',
  },
  langText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A5568',
  },
  langTextSelected: {
    fontWeight: '700',
    color: '#1A73E8',
  },
  betaBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  betaText: {
    color: '#FF8F00',
    fontWeight: '800',
    fontSize: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D32F2F',
  },
  footerBranding: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9E9E9E',
  }
});
