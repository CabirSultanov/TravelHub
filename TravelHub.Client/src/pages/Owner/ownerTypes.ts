import type { Booking, BookingStatus } from '../../types';

export type OwnerBooking = Omit<Booking, 'userId' | 'savedCardLast4'>;
export type OwnerBookingFilters = {
  hotelId?: number;
  search?: string;
  status?: BookingStatus;
  period?: 'upcoming' | 'past' | 'all' | 'arrivals' | 'departures';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};
export type OwnerOverview = {
  today: string;
  arrivalsToday: number;
  departuresToday: number;
  awaitingPayment: number;
  upcomingArrivals: OwnerBooking[];
};
