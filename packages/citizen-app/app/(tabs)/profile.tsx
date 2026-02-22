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
} from 'react-native';
import { useRouter, RelativePathString } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getMeApi, patchMeApi, UserProfile } from '../../services/api';
import { clearAuth, getUser } from '../../services/auth-store';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await getMeApi();
      setProfile(res.data);
      setEditName(res.data.fullName);
      setEditPhone(res.data.phone || '');
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
          createdAt: '',
        });
        setEditName(cached.fullName);
        setEditPhone(cached.phone || '');
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Header */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile ? getInitials(profile.fullName) : '?'}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.fullName || 'Citizen'}</Text>
          <Text style={styles.email}>{profile?.email || 'No email'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#1A73E8" />
            <Text style={styles.roleText}>{profile?.role || 'CITIZEN'}</Text>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Info</Text>
            {!editing && (
              <Pressable onPress={() => setEditing(true)} hitSlop={10}>
                <Ionicons name="create-outline" size={22} color="#1A73E8" />
              </Pressable>
            )}
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Ionicons name="person-outline" size={18} color="#7A8BA8" />
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

          {/* Email */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Ionicons name="mail-outline" size={18} color="#7A8BA8" />
              <Text style={styles.fieldLabelText}>Email</Text>
            </View>
            <Text style={styles.fieldValue}>{profile?.email || 'Not set'}</Text>
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Ionicons name="call-outline" size={18} color="#7A8BA8" />
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

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#D32F2F" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>RakshaSetu v1.0.0</Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A2B4A',
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 14,
    color: '#7A8BA8',
    fontWeight: '500',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A73E8',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B4A',
  },
  field: {
    marginBottom: 18,
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
    fontSize: 16,
    color: '#1A2B4A',
    fontWeight: '600',
    paddingLeft: 24,
  },
  fieldInput: {
    fontSize: 16,
    color: '#1A2B4A',
    fontWeight: '500',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2ECF5',
    marginLeft: 24,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D8E4F0',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7A8BA8',
  },
  saveBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#B0BEC5',
    marginTop: 24,
    fontWeight: '500',
  },
});
