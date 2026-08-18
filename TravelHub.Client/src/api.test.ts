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
