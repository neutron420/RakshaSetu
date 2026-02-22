import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'rakshasetu_token';
const USER_KEY = 'rakshasetu_user';
const SESSION_EXPIRY_KEY = 'rakshasetu_session_expiry';
const REMEMBER_ME_KEY = 'rakshasetu_remember_me';

// 30 days in milliseconds
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// 1 day (default when "remember me" is off)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  await storage.remove(SESSION_EXPIRY_KEY);
  await storage.remove(REMEMBER_ME_KEY);
}

// ─── Session Persistence (30-day login) ─────────────────────────

/**
 * Save session info when user logs in.
 * If rememberMe is true, session lasts 30 days.
 * If false, session lasts 1 day.
 */
export async function saveSession(rememberMe: boolean) {
  const expiresAt = Date.now() + (rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS);
  await storage.set(SESSION_EXPIRY_KEY, String(expiresAt));
  await storage.set(REMEMBER_ME_KEY, rememberMe ? '1' : '0');
}

/**
 * Check if a valid session exists (token + not expired).
 * Returns true if user should be auto-redirected to home.
 */
export async function hasValidSession(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  const expiryStr = await storage.get(SESSION_EXPIRY_KEY);
  if (!expiryStr) {
    // No expiry saved — old login, treat as expired
    return false;
  }

  const expiresAt = Number(expiryStr);
  if (Date.now() > expiresAt) {
    // Session expired — clear everything
    await clearAuth();
    return false;
  }

  return true;
}

/**
 * Get whether "Remember Me" was previously checked.
 */
export async function getRememberMe(): Promise<boolean> {
  const val = await storage.get(REMEMBER_ME_KEY);
  return val === '1';
}
