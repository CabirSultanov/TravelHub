import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, AuthUser } from './types';

const user: AuthUser = {
  id: 1,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phoneNumber: '+994 501234567',
  role: 'User',
  isBlocked: false,
};

const authResponse: AuthResponse = {
  user,
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-08-08T12:15:00Z',
};

const hotel = {
  id: 1,
  name: 'Baku Stay',
  city: 'Baku',
  description: '',
  imageUrl: null,
  imageUrls: [],
  roomTypesCount: 2,
  totalRoomsCount: 10,
  totalGuestPlaces: 20,
  averageRating: 4.5,
  reviewCount: 2,
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('api authentication', () => {
  it('keeps registration unauthenticated until email verification succeeds', async () => {
    const confirmation = {
      emailConfirmationRequired: true,
      email: 'jane@gmail.com',
      expiresAt: '2026-08-30T12:05:00Z',
      resendAvailableAt: '2026-08-30T12:01:00Z',
    };
    const fetchMock = vi.fn(async (url: string) => url === '/api/auth/verify-email' ? jsonResponse(authResponse) : jsonResponse(confirmation));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await expect(api.register({ name: 'Jane Doe', email: 'jane@gmail.com', phoneNumber: '+994501234567', password: 'Travel123!' })).resolves.toEqual(confirmation);
    await expect(api.verifyEmail({ email: 'jane@gmail.com', code: '482731' })).resolves.toEqual(authResponse);
    await api.getMe();

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit | undefined][];
    expect(new Headers(calls[0][1]?.headers).get('Authorization')).toBeNull();
    expect(new Headers(calls[2][1]?.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('returns an email confirmation response for an unconfirmed login', async () => {
    const confirmation = {
      emailConfirmationRequired: true,
      email: 'jane@gmail.com',
      expiresAt: '2026-08-30T12:05:00Z',
      resendAvailableAt: '2026-08-30T12:01:00Z',
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(confirmation, 403)));
    const { api } = await import('./api');

    await expect(api.login({ email: 'jane@gmail.com', password: 'Travel123!' })).resolves.toEqual(confirmation);
  });

  it('shares one refresh request for concurrent 401 responses and retries with the new token', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        return jsonResponse(authResponse);
      }

      if (url === '/api/auth/me' && !new Headers(init?.headers).has('Authorization')) {
        return new Response('Unauthorized', { status: 401 });
      }

      return jsonResponse(user);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    const [firstUser, secondUser] = await Promise.all([api.getMe(), api.getMe()]);
    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    const refreshCalls = calls.filter(([url]) => url === '/api/auth/refresh');
    const protectedCalls = calls.filter(([url]) => url === '/api/auth/me');

    expect(firstUser).toEqual(user);
    expect(secondUser).toEqual(user);
    expect(refreshCalls).toHaveLength(1);
    expect(protectedCalls).toHaveLength(4);
    expect(new Headers(protectedCalls[2][1]?.headers).get('Authorization')).toBe('Bearer access-token');
    expect(new Headers(protectedCalls[2][1]?.headers).get('Content-Type')).toBeNull();
    expect(protectedCalls[2][1]?.credentials).toBe('include');
  });

  it('does not refresh again when the single retry also returns 401', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        return jsonResponse(authResponse);
      }

      return new Response('Unauthorized', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await expect(api.getMe()).rejects.toMatchObject({ status: 401 });

    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    expect(calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
    expect(calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(2);
  });

  it('uses the first validation error message from API problem details', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          title: 'One or more validation errors occurred.',
          errors: {
            Email: ['Please enter a valid email address.'],
          },
        },
        400,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await expect(
      api.register({
        name: 'Jane Doe',
        email: 'bad-email',
        phoneNumber: '+994501234567',
        password: 'Travel123!',
      }),
    ).rejects.toThrow('Please enter a valid email address.');
  });
});

describe('api image uploads', () => {
  it('uploads taxi images through the dedicated taxi endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ imageUrl: 'https://res.cloudinary.com/demo/taxi.jpg' }));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await expect(api.uploadTaxiImage(new File(['image'], 'taxi.jpg', { type: 'image/jpeg' }))).resolves.toEqual({ imageUrl: 'https://res.cloudinary.com/demo/taxi.jpg' });

    expect(fetchMock).toHaveBeenCalledWith('/api/taxi-images', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });
});

describe('api admin users', () => {
  it('requests paginated regular users', async () => {
    const pagedUsers = {
      items: [user],
      page: 2,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
    };
    const fetchMock = vi.fn(async () => jsonResponse(pagedUsers));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    const response = await api.getAdminCandidates(2, 10);

    expect(response).toEqual(pagedUsers);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admins/users?page=2&pageSize=10',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('loads candidates and sends owner assignments through protected endpoints', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([user]));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await api.getOwnerCandidates('hotel');
    await api.updateHotelOwner(7, 1);
    await api.updateTaxiServiceOwner(9, null);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit | undefined][];
    expect(calls[0][0]).toBe('/api/ownership/users?role=hotel');
    expect(calls[1]).toEqual(['/api/hotels/7/owner', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ ownerId: 1 }) })]);
    expect(calls[2]).toEqual(['/api/taxi-services/9/owner', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ ownerId: null }) })]);
  });
});

describe('api hotels', () => {
  it('requests paginated hotels with city filter', async () => {
    const pagedHotels = {
      items: [hotel],
      page: 2,
      pageSize: 3,
      totalItems: 4,
      totalPages: 2,
    };
    const fetchMock = vi.fn(async () => jsonResponse(pagedHotels));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    const response = await api.getHotels({ page: 2, pageSize: 3, city: 'Baku' });

    expect(response).toEqual(pagedHotels);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/hotels?page=2&pageSize=3&city=Baku',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('requests hotel cities', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(['Baku', 'Gabala']));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');

    await expect(api.getHotelCities()).resolves.toEqual(['Baku', 'Gabala']);
    expect(fetchMock).toHaveBeenCalledWith('/api/hotels/cities', expect.objectContaining({ credentials: 'include' }));
  });

  it('requests and mutates hotel reviews through the existing API wrapper', async () => {
    const reviews = {
      items: [],
      page: 1,
      pageSize: 3,
      totalItems: 0,
      totalPages: 0,
      averageRating: null,
      reviewCount: 0,
      currentUserReviewCount: null,
    };
    const fetchMock = vi.fn(async () => jsonResponse(reviews));
    vi.stubGlobal('fetch', fetchMock);
    const { api } = await import('./api');
    const review = { rating: 5, comment: null };

    await api.getHotelReviews(7);
    await api.createHotelReview(7, review);
    await api.updateHotelReview(7, 9, review);
    await api.deleteHotelReview(7, 9);

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit | undefined][];
    expect(calls[0][0]).toBe('/api/hotels/7/reviews?page=1&pageSize=3');
    expect(calls[1][0]).toBe('/api/hotels/7/reviews');
    expect(calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify(review) });
    expect(calls[2][0]).toBe('/api/hotels/7/reviews/9');
    expect(calls[2][1]).toMatchObject({ method: 'PUT', body: JSON.stringify(review) });
    expect(calls[3][1]).toMatchObject({ method: 'DELETE' });
  });

  it('returns null when the current user has not reviewed a hotel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const { api } = await import('./api');

    await expect(api.getMyHotelReview(7)).resolves.toBeNull();
  });
});
