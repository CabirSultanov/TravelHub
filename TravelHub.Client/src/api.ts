import type {
  AuthResponse,
  AuthUser,
  Booking,
  BookingCreate,
  BookingPayment,
  Hotel,
  HotelInput,
  HotelRoom,
  HotelRoomInput,
  HotelUpdateInput,
  LoginRequest,
  PaymentCardCreate,
  PagedResponse,
  RegisterRequest,
  SavedPaymentCard,
  TaxiBooking,
  TaxiBookingCreate,
  TaxiRoutePreview,
  TaxiRoutePreviewRequest,
  TaxiService,
  TaxiServiceInput,
  UpdateProfileRequest,
} from './types';

const refreshUrl = '/api/auth/refresh';
const authEndpoints = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
]);

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  skipAuthRefresh?: boolean;
  skipAccessToken?: boolean;
};

async function fetchResponse(url: string, init: RequestInit | undefined, skipAccessToken: boolean) {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;

  if (init?.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken && !skipAccessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = getApiErrorMessage(await response.text());
    throw new ApiError(message || 'Request failed with status ' + response.status, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function getApiErrorMessage(body: string) {
  if (!body) {
    return '';
  }

  try {
    const parsed = JSON.parse(body) as unknown;

    if (typeof parsed === 'string') {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      const problem = parsed as { title?: unknown; errors?: unknown };

      if (problem.errors && typeof problem.errors === 'object') {
        const firstError = Object.values(problem.errors as Record<string, unknown>)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .find((value): value is string => typeof value === 'string');

        if (firstError) {
          return firstError;
        }
      }

      if (typeof problem.title === 'string') {
        return problem.title;
      }
    }
  } catch {
    return body;
  }

  return body;
}

async function request<T>(url: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const response = await fetchResponse(url, init, options.skipAccessToken === true);

  if (response.status === 401 && !options.skipAuthRefresh && !authEndpoints.has(url)) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      const retryResponse = await fetchResponse(url, init, false);
      return parseResponse<T>(retryResponse);
    }
  }

  return parseResponse<T>(response);
}

async function refreshAccessToken(): Promise<AuthResponse | null> {
  if (!refreshPromise) {
    refreshPromise = request<AuthResponse>(
      refreshUrl,
      { method: 'POST' },
      { skipAuthRefresh: true, skipAccessToken: true },
    )
      .then((response) => {
        accessToken = response.accessToken;
        return response;
      })
      .catch(() => {
        accessToken = null;
        sessionExpiredHandler?.();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export const api = {
  setSessionExpiredHandler: (handler: (() => void) | null) => {
    sessionExpiredHandler = handler;
  },
  register: async (account: RegisterRequest) => {
    const response = await request<AuthResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(account),
      },
      { skipAuthRefresh: true },
    );
    accessToken = response.accessToken;
    return response;
  },
  login: async (account: LoginRequest) => {
    const response = await request<AuthResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(account),
      },
      { skipAuthRefresh: true },
    );
    accessToken = response.accessToken;
    return response;
  },
  refresh: refreshAccessToken,
  logout: async () => {
    try {
      await request<void>(
        '/api/auth/logout',
        { method: 'POST' },
        { skipAuthRefresh: true, skipAccessToken: true },
      );
    } finally {
      accessToken = null;
    }
  },
  getMe: () => request<AuthUser>('/api/auth/me'),
  updateProfile: (profile: UpdateProfileRequest) =>
    request<AuthUser>('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
  deleteProfile: async () => {
    await request<void>('/api/auth/me', {
      method: 'DELETE',
    });
    accessToken = null;
  },
  getAdmins: () => request<AuthUser[]>('/api/admins'),
  getAdminCandidates: (page = 1, pageSize = 10) => {
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    return request<PagedResponse<AuthUser>>(`/api/admins/users?${search}`);
  },
  promoteUserToAdmin: (userId: number) =>
    request<AuthUser>(`/api/admins/${userId}`, {
      method: 'PUT',
    }),
  demoteAdminToUser: (userId: number) =>
    request<void>(`/api/admins/${userId}/demote`, {
      method: 'PUT',
    }),
  blockUser: (userId: number) =>
    request<AuthUser>(`/api/admins/${userId}/block`, {
      method: 'PUT',
    }),
  unblockUser: (userId: number) =>
    request<AuthUser>(`/api/admins/${userId}/unblock`, {
      method: 'PUT',
    }),
  deleteAccount: (userId: number) =>
    request<void>(`/api/admins/${userId}/account`, {
      method: 'DELETE',
    }),
  getHotels: ({ page = 1, pageSize = 3, city = '' }: { page?: number; pageSize?: number; city?: string } = {}) => {
    const search = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (city) {
      search.set('city', city);
    }

    return request<PagedResponse<Hotel>>(`/api/hotels?${search}`);
  },
  getHotel: (hotelId: number) => request<Hotel>(`/api/hotels/${hotelId}`),
  getHotelCities: () => request<string[]>('/api/hotels/cities'),
  uploadHotelImage: (file: File) => {
    const formData = new FormData();
    formData.set('file', file);

    return request<{ imageUrl: string }>('/api/hotel-images', {
      method: 'POST',
      body: formData,
    });
  },
  uploadRoomImage: (file: File) => {
    const formData = new FormData();
    formData.set('file', file);

    return request<{ imageUrl: string }>('/api/room-images', {
      method: 'POST',
      body: formData,
    });
  },
  createHotel: (hotel: HotelInput) =>
    request<Hotel>('/api/hotels', {
      method: 'POST',
      body: JSON.stringify(hotel),
    }),
  updateHotel: (hotelId: number, hotel: HotelUpdateInput) =>
    request<void>(`/api/hotels/${hotelId}`, {
      method: 'PUT',
      body: JSON.stringify(hotel),
    }),
  deleteHotel: (hotelId: number) =>
    request<void>(`/api/hotels/${hotelId}`, {
      method: 'DELETE',
    }),
  getHotelRooms: (hotelId: number) => request<HotelRoom[]>(`/api/hotel-rooms?hotelId=${hotelId}`),
  createHotelRoom: (room: HotelRoomInput) =>
    request<HotelRoom>('/api/hotel-rooms', {
      method: 'POST',
      body: JSON.stringify(room),
    }),
  updateHotelRoom: (roomId: number, room: HotelRoomInput) =>
    request<void>(`/api/hotel-rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(room),
    }),
  deleteHotelRoom: (roomId: number) =>
    request<void>(`/api/hotel-rooms/${roomId}`, {
      method: 'DELETE',
    }),
  getPaymentCards: () => request<SavedPaymentCard[]>('/api/payment-cards'),
  createPaymentCard: (card: PaymentCardCreate) =>
    request<SavedPaymentCard>('/api/payment-cards', {
      method: 'POST',
      body: JSON.stringify(card),
    }),
  deletePaymentCard: (cardId: number) =>
    request<void>(`/api/payment-cards/${cardId}`, {
      method: 'DELETE',
    }),
  getTaxiServices: () => request<TaxiService[]>('/api/taxi-services'),
  createTaxiService: (taxiService: TaxiServiceInput) =>
    request<TaxiService>('/api/taxi-services', {
      method: 'POST',
      body: JSON.stringify(taxiService),
    }),
  updateTaxiService: (taxiServiceId: number, taxiService: TaxiServiceInput) =>
    request<TaxiService>(`/api/taxi-services/${taxiServiceId}`, {
      method: 'PUT',
      body: JSON.stringify(taxiService),
    }),
  deleteTaxiService: (taxiServiceId: number) =>
    request<void>(`/api/taxi-services/${taxiServiceId}`, {
      method: 'DELETE',
    }),
  getTaxiBookings: (mine = false) => request<TaxiBooking[]>(`/api/taxi-bookings${mine ? '?mine=true' : ''}`),
  createTaxiBooking: (booking: TaxiBookingCreate) =>
    request<TaxiBooking>('/api/taxi-bookings', {
      method: 'POST',
      body: JSON.stringify(booking),
    }),
  previewTaxiRoute: (route: TaxiRoutePreviewRequest, signal?: AbortSignal) =>
    request<TaxiRoutePreview>('/api/taxi-routes/preview', {
      method: 'POST',
      body: JSON.stringify(route),
      signal,
    }),
  payTaxiBooking: (bookingId: number, payment: BookingPayment) =>
    request<TaxiBooking>(`/api/taxi-bookings/${bookingId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payment),
    }),
  cancelTaxiBooking: (bookingId: number) =>
    request<void>(`/api/taxi-bookings/${bookingId}/cancel`, {
      method: 'PUT',
    }),
  getBookings: (mine = false) => request<Booking[]>(`/api/booking-requests${mine ? '?mine=true' : ''}`),
  createBooking: (booking: BookingCreate) =>
    request<Booking>('/api/booking-requests', {
      method: 'POST',
      body: JSON.stringify(booking),
    }),
  payBooking: (bookingId: number, payment: BookingPayment) =>
    request<Booking>(`/api/booking-requests/${bookingId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payment),
    }),
  cancelBooking: (bookingId: number) =>
    request<void>(`/api/booking-requests/${bookingId}/cancel`, {
      method: 'PUT',
    }),
};
