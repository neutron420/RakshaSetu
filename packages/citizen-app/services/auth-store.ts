import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'rakshasetu_token';
const USER_KEY = 'rakshasetu_user';

export type StoredUser = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: string;
};

// Web fallback (SecureStore only works on iOS/Android)
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export async function saveToken(token: string) {
  await storage.set(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return storage.get(TOKEN_KEY);
}

export async function removeToken() {
  await storage.remove(TOKEN_KEY);
}

export async function saveUser(user: StoredUser) {
  await storage.set(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await storage.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearAuth() {
  await storage.remove(TOKEN_KEY);
  await storage.remove(USER_KEY);
}
