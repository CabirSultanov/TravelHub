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
} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
  getHotels: () => request<Hotel[]>('/api/hotels'),
  getHotelRooms: (hotelId: number) => request<HotelRoom[]>(`/api/hotel-rooms?hotelId=${hotelId}`),
  getTaxiServices: () => request<TaxiService[]>('/api/taxi-services'),
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
