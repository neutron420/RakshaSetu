import { getToken } from './auth-store';

export const BASE_URL = __DEV__
  ? 'http://172.29.21.53:5001/api/v1'
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

export type SosCategory =
  | 'FLOOD' | 'FIRE' | 'EARTHQUAKE' | 'ACCIDENT'
  | 'MEDICAL' | 'VIOLENCE' | 'LANDSLIDE' | 'CYCLONE' | 'OTHER';

export type SosReport = {
  id: string;
  category: SosCategory;
  description: string | null;
  latitude: number;
  longitude: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

// ─── SOS API ─────────────────────────────────────────

export function createSosApi(body: {
  category: SosCategory;
  description?: string;
  latitude: number;
  longitude: number;
  clientReportId?: string;
}) {
  return request<{ reportId: string; status: string; reportedAt: string; duplicate: boolean }>('/sos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listMySosReportsApi() {
  return request<SosReport[]>('/sos/my');
}

export type IncidentStatus =
  | 'OPEN' | 'INVESTIGATING' | 'IN_PROGRESS'
  | 'CONTAINED' | 'RESOLVED' | 'CLOSED';

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Incident = {
  severity: string;
  id: string;
  category: SosCategory;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  centroidLat: number;
  centroidLng: number;
  clusterRadiusMeters: number;
  reportCount: number;
  representativeMediaUrl?: string | null;
  confidenceScore: number | null;
  firstReportedAt: string;
  lastReportedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginatedApiResponse<T> = {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginatedMeta;
};

export type IncidentMedia = {
  id: string;
  reportId: string;
  mediaType: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
  uploadedAt: string;
};


export async function listIncidentsApi(params?: {
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  category?: SosCategory;
}): Promise<PaginatedApiResponse<Incident>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.category) query.set('category', params.category);
  const qs = query.toString();

  const res = await fetch(`${BASE_URL}/incidents${qs ? `?${qs}` : ''}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(await getToken() ? { Authorization: `Bearer ${await getToken()}` } : {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch incidents');
  return json as PaginatedApiResponse<Incident>;
}

export function getIncidentByIdApi(id: string) {
  return request<Incident>(`/incidents/${id}`);
}

export function getNearbyIncidentsApi(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusMeters: String(params.radiusMeters ?? 30000),
  });
  return request<Incident[]>(`/incidents/nearby?${query.toString()}`);
}


export function getIncidentMediaApi(id: string) {
  return request<IncidentMedia[]>(`/incidents/${id}/media`);
}


export type UserProfile = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

// ─── Users API ───────────────────────────────────────

export function getMeApi() {
  return request<UserProfile>('/users/me');
}

export function patchMeApi(body: {
  fullName?: string;
  phone?: string | null;
  pushToken?: string;
  latitude?: number;
  longitude?: number;
}) {
  return request<UserProfile>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ─── Relief Center Types ───────────────────────────
export type ReliefCenterType = 'SHELTER' | 'HOSPITAL' | 'FOOD_CENTER' | 'OTHER';
export type ReliefCenterStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'INACTIVE';

export type ReliefCenter = {
  id: string;
  name: string;
  type: ReliefCenterType;
  status: ReliefCenterStatus;
  description: string | null;
  address: string | null;
  maxCapacity: number | null;
  currentCount: number;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  distance?: number;
};

// ─── Relief Center API ──────────────────────────────

export function getNearbyReliefCentersApi(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusMeters: String(params.radiusMeters ?? 30000),
  });
  return request<ReliefCenter[]>(`/relief-centers/nearby?${query.toString()}`);
}

export function getReliefCenterByIdApi(id: string) {
  return request<ReliefCenter>(`/relief-centers/${id}`);
}

export function fetchAutomatedReliefCentersApi(body: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  return request<{ added: number; totalProcessed: number; message?: string }>('/relief-centers/fetch-automated', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── SOS Media Types ─────────────────────────────────

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export type SosMedia = {
  id: string;
  reportId: string;
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type UploadUrlResponse = {
  url: string;
  key: string;
};

// ─── SOS Media API ───────────────────────────────────

export function getUploadUrlApi(contentType: string = 'image/jpeg') {
  const query = new URLSearchParams({ contentType });
  return request<UploadUrlResponse>(`/sos/upload-url?${query.toString()}`);
}

export function addMediaApi(reportId: string, body: {
  mediaType: MediaType;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  return request<SosMedia>(`/sos/${reportId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getMediaApi(reportId: string) {
  return request<SosMedia[]>(`/sos/${reportId}/media`);
}

/**
 * Upload a file to R2 using a presigned URL.
 * This doesn't go through our API wrapper since it's a direct PUT to R2.
 */
export async function uploadFileToR2(presignedUrl: string, fileUri: string, contentType: string) {
  console.log(`[r2] Starting upload to R2. Content-Type: ${contentType}`);
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    console.log(`[r2] Blob created, size: ${blob.size} bytes`);

    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    console.log(`[r2] PUT response status: ${uploadRes.status}`);

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text().catch(() => "No error body");
      console.error(`[r2] Upload failed: ${errorText}`);
      throw new Error(`Upload failed (${uploadRes.status}): ${errorText}`);
    }
    console.log(`[r2] Upload successful!`);
  } catch (err) {
    console.error(`[r2] Error during upload:`, err);
    throw err;
  }
}

// ─── Upvote Types ────────────────────────────────────

export type UpvoteInfo = {
  incidentId: string;
  count: number;
  userVoted: boolean;
};

export type ToggleUpvoteResponse = {
  incidentId: string;
  voted: boolean;
  count: number;
};

// ─── Upvote API ──────────────────────────────────────

export function toggleUpvoteApi(incidentId: string) {
  return request<ToggleUpvoteResponse>(`/incidents/${incidentId}/upvote`, {
    method: 'POST',
  });
}

export function getUpvoteInfoApi(incidentId: string) {
  return request<UpvoteInfo>(`/incidents/${incidentId}/upvotes`);
}

export function batchGetUpvotesApi(incidentIds: string[]) {
  return request<UpvoteInfo[]>('/incidents/upvotes/batch', {
    method: 'POST',
    body: JSON.stringify({ incidentIds }),
  });
}

