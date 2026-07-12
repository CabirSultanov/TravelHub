import type {
  AuthUser,
  Booking,
  BookingCreate,
  BookingPayment,
  Hotel,
  HotelRoom,
  LoginRequest,
  Place,
  RegisterRequest,
  TaxiService,
  TaxiServiceInput,
} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (account: RegisterRequest) =>
    request<AuthUser>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(account),
    }),
  login: (account: LoginRequest) =>
    request<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(account),
    }),
  logout: () =>
    request<void>('/api/auth/logout', {
      method: 'POST',
    }),
  getMe: () => request<AuthUser>('/api/auth/me'),
  getAdmins: () => request<AuthUser[]>('/api/admins'),
  getAdminCandidates: () => request<AuthUser[]>('/api/admins?role=User'),
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
  getHotels: () => request<Hotel[]>('/api/hotels'),
  getHotelRooms: (hotelId: number) => request<HotelRoom[]>(`/api/hotel-rooms?hotelId=${hotelId}`),
  getTaxiServices: () => request<TaxiService[]>('/api/taxi-services'),
  createTaxiService: (taxiService: TaxiServiceInput) =>
    request<TaxiService>('/api/taxi-services', {
      method: 'POST',
      body: JSON.stringify(taxiService),
    }),
  updateTaxiService: (taxiServiceId: number, taxiService: TaxiServiceInput) =>
    request<void>(`/api/taxi-services/${taxiServiceId}`, {
      method: 'PUT',
      body: JSON.stringify(taxiService),
    }),
  deleteTaxiService: (taxiServiceId: number) =>
    request<void>(`/api/taxi-services/${taxiServiceId}`, {
      method: 'DELETE',
    }),
  getPlaces: () => request<Place[]>('/api/places'),
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
