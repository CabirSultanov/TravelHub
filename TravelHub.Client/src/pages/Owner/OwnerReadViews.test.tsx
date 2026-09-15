import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { api } from '../../api';
import type { Hotel, HotelReviewsResponse, PagedResponse } from '../../types';
import OwnerBookings from './OwnerBookings';
import OwnerReviews from './OwnerReviews';
import type { OwnerBooking } from './ownerTypes';
import { useOwnerQuery } from './useOwnerQuery';

vi.mock('./useOwnerQuery', () => ({ useOwnerQuery: vi.fn() }));

const hotel: Hotel = { id: 7, ownerId: 1, name: 'Harbor Hotel', city: 'Baku', description: '', imageUrls: [], roomTypesCount: 2, totalRoomsCount: 50, totalGuestPlaces: 100, averageRating: 4, reviewCount: 1 };
const booking: OwnerBooking = { id: 31, hotelId: 7, hotelRoomId: 2, hotelName: hotel.name, roomType: 'Family', customerName: 'Guest Name', email: 'guest@example.test', phoneNumber: '+994 501234567', checkInDate: '2026-09-20', checkOutDate: '2026-09-22', status: 'Paid', totalPrice: 240.75, paidAt: '2026-09-15T12:00:00Z' };
const bookings: PagedResponse<OwnerBooking> = { items: [booking], page: 1, pageSize: 20, totalItems: 21, totalPages: 2 };
const reviews: HotelReviewsResponse = { items: [{ id: 9, hotelId: hotel.id, userId: 2, userName: 'Review Author', rating: 4, comment: 'Quiet room and helpful staff.', createdAt: '2026-09-14T10:00:00Z', updatedAt: null }], page: 1, pageSize: 10, totalItems: 11, totalPages: 2, reviewCount: 11, averageRating: 4.2, currentUserReviewCount: 0 };

function setQuery(data: unknown, overrides: Partial<ReturnType<typeof useOwnerQuery>> = {}) {
  vi.mocked(useOwnerQuery).mockReturnValue({ data, loading: false, refreshing: false, error: '', accessDenied: false, reload: vi.fn().mockResolvedValue(undefined), ...overrides, key: 'test' });
}

beforeEach(() => { vi.restoreAllMocks(); vi.mocked(useOwnerQuery).mockReset(); setQuery(null, { loading: true }); });

describe('owner booking view', () => {
  it.each([
    [undefined, 'upcoming', undefined],
    ['arrivals', 'arrivals', 'Paid'],
    ['departures', 'departures', 'Paid'],
    ['awaiting', 'upcoming', 'PendingPayment'],
  ] as const)('matches the overview drill %s and sends its scope to the paged API', async (initialFilter, period, status) => {
    const get = vi.spyOn(api, 'getOwnerBookings').mockResolvedValue(bookings);
    renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" initialFilter={initialFilter} />);
    const [key, loader, pollMs] = vi.mocked(useOwnerQuery).mock.calls[0];
    expect(JSON.parse(key)).toEqual(['owner-bookings', 'account-1', expect.objectContaining({ hotelId: 7, period, page: 1, pageSize: 20 })]);
    expect(pollMs).toBe(30_000);
    const controller = new AbortController();
    await loader(controller.signal);
    expect(get).toHaveBeenCalledWith({ hotelId: 7, period, status, page: 1, pageSize: 20 }, controller.signal);
  });

  it('shows stored totals including cents, scheduled dates and read-only detail controls', () => {
    setQuery(bookings);
    const html = renderToStaticMarkup(<OwnerBookings hotelId={null} accountKey="account-1" />);
    expect(html).toContain('$240.75');
    expect(html).toContain('2026-09-20');
    expect(html).toContain('Guest Name');
    expect(html).toContain('View details');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Owner bookings pages');
    expect(html).not.toMatch(/>Pay now<|>Cancel booking<|>Check in<|>Check out</);
  });

  it('distinguishes loading and failed loads from an empty result; keeps last data on connection failure', () => {
    let html = renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" />);
    expect(html).toContain('Loading bookings');
    expect(html).not.toContain('No bookings match');
    setQuery(null, { error: 'Connection lost' });
    html = renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" />);
    expect(html).toContain('Connection lost');
    expect(html).not.toContain('No bookings match');
    setQuery(bookings, { error: 'Connection lost' });
    html = renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" />);
    expect(html).toContain('Showing the last loaded bookings');
    expect(html).toContain('Guest Name');
    setQuery({ ...bookings, items: [], totalItems: 0, totalPages: 0 });
    expect(renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" />)).toContain('No bookings match');
  });

  it('hides prior guest data after access is denied, even if a stale result remains', () => {
    setQuery(bookings, { accessDenied: true, error: 'Access unavailable' });
    const html = renderToStaticMarkup(<OwnerBookings hotelId={7} accountKey="account-1" />);
    expect(html).toContain('Access unavailable');
    expect(html).not.toContain('Guest Name');
    expect(html).not.toContain('View details');
  });
});

describe('owner reviews view', () => {
  it('reuses reviews with a scoped query and cancellation signal, without polling or write controls', async () => {
    setQuery(reviews);
    const get = vi.spyOn(api, 'getHotelReviews').mockResolvedValue(reviews);
    const authorize = vi.spyOn(api, 'getOwnerOverview').mockResolvedValue({ today: '2026-09-15', arrivalsToday: 0, departuresToday: 0, awaitingPayment: 0, upcomingArrivals: [] });
    const html = renderToStaticMarkup(<OwnerReviews hotel={hotel} accountKey="account-1" />);
    expect(html).toContain('4.2 / 5');
    expect(html).toContain('11 reviews');
    expect(html).toContain('Review Author');
    expect(html).toContain('Quiet room and helpful staff.');
    expect(html).toContain('Owner reviews pages');
    expect(html).not.toMatch(/>Delete<|>Reply<|>Rate this hotel</);
    const [key, loader, pollMs] = vi.mocked(useOwnerQuery).mock.calls[0];
    expect(JSON.parse(key)).toEqual(['owner-reviews', 'account-1', 7, 1]);
    expect(pollMs).toBeUndefined();
    const controller = new AbortController();
    await loader(controller.signal);
    expect(authorize).toHaveBeenCalledWith(7, controller.signal);
    expect(get).toHaveBeenCalledWith(7, 1, 10, controller.signal);
  });

  it('only shows no reviews after a successful empty response and hides data on access denial', () => {
    expect(renderToStaticMarkup(<OwnerReviews hotel={hotel} accountKey="account-1" />)).not.toContain('No reviews yet');
    setQuery(null, { error: 'Could not load' });
    expect(renderToStaticMarkup(<OwnerReviews hotel={hotel} accountKey="account-1" />)).not.toContain('No reviews yet');
    setQuery({ ...reviews, items: [], totalItems: 0, totalPages: 0, averageRating: null, reviewCount: 0 });
    expect(renderToStaticMarkup(<OwnerReviews hotel={hotel} accountKey="account-1" />)).toContain('No reviews yet');
    setQuery(reviews, { accessDenied: true, error: 'Access unavailable' });
    expect(renderToStaticMarkup(<OwnerReviews hotel={hotel} accountKey="account-1" />)).not.toContain('Review Author');
  });
});
