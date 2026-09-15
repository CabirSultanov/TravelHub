import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { api } from '../../api';
import SiteHeader from '../../components/common/SiteHeader';
import type { AuthUser, Hotel } from '../../types';
import { buildAuthUrl, buildParsedRouteUrl, parseAppRoute, safeReturnTo } from '../../utils/routing';
import { loadOwnedHotels } from './OwnerWorkspacePage';

afterEach(() => vi.restoreAllMocks());

describe('hotel workspace navigation and data', () => {
  it('preserves /owner through direct links and authentication reloads', () => {
    expect(buildParsedRouteUrl(parseAppRoute('/owner'))).toBe('/owner');
    const url = buildAuthUrl('login', null, '/owner');
    const route = parseAppRoute('/auth', url.slice(url.indexOf('?')));
    expect(route.returnTo).toBe('/owner');
    expect(buildParsedRouteUrl(route)).toBe(url);
    const detail = '/hotels/42?roomId=6';
    expect(parseAppRoute('/auth', `?returnTo=${encodeURIComponent(detail)}`).returnTo).toBe(detail);
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', '/auth?returnTo=/owner', '/api/owner', 'javascript:alert(1)'])('rejects unsafe return destination %s', (url) => {
    expect(safeReturnTo(url)).toBeNull();
    expect(buildAuthUrl('login', null, url)).toBe('/auth?mode=login');
  });

  it('shows My hotels only for HotelOwner without hiding the public Hotel link', () => {
    const user: AuthUser = { id: 7, name: 'Test owner', role: 'HotelOwner', email: 'owner@example.test', phoneNumber: '+994500000007', isBlocked: false };
    const render = (role: AuthUser['role']) => renderToStaticMarkup(<SiteHeader currentUser={{ ...user, role }} page="owner" submitting={false} onNavigate={() => undefined} onOpenAuth={() => undefined} onLogout={() => undefined} />);
    expect(render('HotelOwner')).toContain('My hotels');
    expect(render('HotelOwner')).toContain('<span>Hotel</span>');
    for (const role of ['User', 'TaxiDriver', 'TaxiOwner', 'Admin', 'SuperAdmin'] as const) expect(render(role)).not.toContain('My hotels');
  });

  it('loads every page of owned hotels and never substitutes the public catalog', async () => {
    const hotels = [{ id: 1 }, { id: 101 }] as Hotel[];
    const owned = vi.spyOn(api, 'getOwnerHotels').mockResolvedValueOnce({ items: [hotels[0]], page: 1, pageSize: 100, totalItems: 101, totalPages: 2 })
      .mockResolvedValueOnce({ items: [hotels[1]], page: 2, pageSize: 100, totalItems: 101, totalPages: 2 });
    const catalog = vi.spyOn(api, 'getHotels');
    const signal = new AbortController().signal;
    expect(await loadOwnedHotels(signal)).toEqual(hotels);
    expect(owned).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 }, signal);
    expect(catalog).not.toHaveBeenCalled();
  });

  it('does not return a partial hotel list when a later page fails', async () => {
    vi.spyOn(api, 'getOwnerHotels').mockResolvedValueOnce({ items: [{ id: 1 } as Hotel], page: 1, pageSize: 100, totalItems: 101, totalPages: 2 }).mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(loadOwnedHotels()).rejects.toThrow('Network unavailable');
  });
});
