import type { AuthResponse, AuthUser, DriverRide, LoginRequest } from '@/types/auth';
import { getApiBaseUrl } from '@/config/apiConfig';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null,
  ) {
    super(message);
  }
}

function getErrorMessage(body: unknown) {
  if (typeof body === 'string') {
    return body;
  }

  if (body && typeof body === 'object') {
    const problem = body as { title?: unknown; errors?: Record<string, unknown> };
    if (typeof problem.title === 'string') {
      return problem.title;
    }

    const firstError = Object.values(problem.errors ?? {})
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .find((value): value is string => typeof value === 'string');
    if (firstError) {
      return firstError;
    }
  }

  return '';
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string, timeoutMs = 15_000): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const url = `${getApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
    text = await response.text();
  } catch {
    if (init.signal?.aborted) throw Object.assign(new Error('Request cancelled.'), { name: 'AbortError' });
    throw new ApiError(
      'TravelHub API is not reachable. Make sure TravelHub.Api is running with the "mobile" profile, your phone and computer are on the same Wi-Fi, and Windows Firewall allows .NET on Private networks.',
      0,
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }

  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // The API can return plain-text validation messages.
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(body) || `Request failed with status ${response.status}.`, response.status, body);
  }

  return body as T;
}

export function isEmailConfirmationRequired(error: unknown) {
  return error instanceof ApiError
    && error.status === 403
    && typeof error.body === 'object'
    && error.body !== null
    && (error.body as { emailConfirmationRequired?: unknown }).emailConfirmationRequired === true;
}

export const api = {
  health: () => request<{ status: string }>('/health', {}, undefined, 5_000),
  login: (requestBody: LoginRequest) => request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  }),
  getCurrentUser: (accessToken: string) => request<AuthUser>('/api/auth/me', {}, accessToken),
  getTaxiService: (id: number, accessToken: string, signal?: AbortSignal) => request<{ id: number; companyName: string; city: string; phoneNumber: string }>(`/api/taxi-services/${id}`, { signal }, accessToken),
  getAvailableRides: (accessToken: string, signal?: AbortSignal) => request<DriverRide[]>('/api/driver/taxi-bookings/available', { signal }, accessToken),
  getActiveRide: async (accessToken: string, signal?: AbortSignal) => {
    try {
      return await request<DriverRide>('/api/driver/taxi-bookings/active', { signal }, accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  getRideHistory: (accessToken: string, signal?: AbortSignal) => request<DriverRide[]>('/api/driver/taxi-bookings/history', { signal }, accessToken),
  acceptRide: (rideId: number, accessToken: string, signal?: AbortSignal) => request<DriverRide>(`/api/driver/taxi-bookings/${rideId}/accept`, { method: 'POST', signal }, accessToken),
  declineRide: (rideId: number, accessToken: string, signal?: AbortSignal) => request<void>(`/api/driver/taxi-bookings/${rideId}/decline`, { method: 'POST', signal }, accessToken),
  markRideArrived: (rideId: number, accessToken: string, signal?: AbortSignal) => request<DriverRide>(`/api/driver/taxi-bookings/${rideId}/arrived`, { method: 'POST', signal }, accessToken),
  completeRide: (rideId: number, accessToken: string, signal?: AbortSignal) => request<DriverRide>(`/api/driver/taxi-bookings/${rideId}/complete`, { method: 'POST', signal }, accessToken),
};
