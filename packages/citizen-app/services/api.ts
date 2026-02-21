import { getToken } from './auth-store';
const BASE_URL = __DEV__
  ? 'http://172.29.27.167:5001/api/v1'
  : 'https://your-production-api.com/api/v1';

type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json as ApiResponse<T>;
}

// ─── Auth Types ──────────────────────────────────────
export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  tokenType: string;
};

export type OtpResponse = {
  message: string;
};

// ─── Auth API ────────────────────────────────────────

export function signupApi(body: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function loginApi(body: { email: string; password: string }) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function requestOtpApi(body: { phone: string }) {
  return request<OtpResponse>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function verifyOtpApi(body: { phone: string; code: string }) {
  return request<AuthResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
