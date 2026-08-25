import type { AuthMode, Page } from '../types';
import { normalizeHotelDateRange, todayDateInputValue } from './dateRange';

export type HotelRouteSearch = {
  city: string;
  checkIn: string;
  checkOut: string;
  roomId: number | null;
  page: number;
};

export type TaxiRouteSearch = {
  serviceId: number | null;
  carClassName: string;
};

export type ParsedRoute = {
  page: Page;
  hotelId: number | null;
  hotels: HotelRouteSearch;
  taxi: TaxiRouteSearch;
  authMode: AuthMode;
};

export const pageRoutes: Record<Page, string> = {
  home: '/',
  taxi: '/taxi',
  hotels: '/hotels',
  auth: '/auth',
  admin: '/admin',
  profile: '/profile',
  trips: '/my-trips',
};

const appPages = Object.keys(pageRoutes) as Page[];

export const emptyHotelRouteSearch: HotelRouteSearch = {
  city: '',
  checkIn: '',
  checkOut: '',
  roomId: null,
  page: 1,
};

export const emptyTaxiRouteSearch: TaxiRouteSearch = {
  serviceId: null,
  carClassName: '',
};

function stripUrlSuffix(pathname: string) {
  return pathname.split('?')[0].split('#')[0];
}

function cleanTextParam(value: string | null) {
  return (value ?? '').trim().slice(0, 100);
}

function parsePositiveInt(value: string | null) {
  const trimmed = (value ?? '').trim();

  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

export function normalizeHotelRouteSearch(search: Partial<HotelRouteSearch>): HotelRouteSearch {
  const { checkIn, checkOut } = normalizeHotelDateRange(search.checkIn ?? '', search.checkOut ?? '', {
    minCheckInDate: todayDateInputValue(),
  });

  return {
    city: cleanTextParam(search.city ?? ''),
    checkIn,
    checkOut,
    roomId: typeof search.roomId === 'number' && search.roomId > 0 ? search.roomId : null,
    page: typeof search.page === 'number' && search.page > 0 ? Math.floor(search.page) : 1,
  };
}

export function normalizeTaxiRouteSearch(search: Partial<TaxiRouteSearch>): TaxiRouteSearch {
  return {
    serviceId: typeof search.serviceId === 'number' && search.serviceId > 0 ? search.serviceId : null,
    carClassName: cleanTextParam(search.carClassName ?? ''),
  };
}

export function getPageFromPathname(pathname: string): Page {
  const cleanPath = stripUrlSuffix(pathname).replace(/\/+$/, '') || '/';

  if (cleanPath.startsWith('/hotels/')) {
    return 'hotels';
  }

  return appPages.find((currentPage) => pageRoutes[currentPage] === cleanPath) ?? 'home';
}

export function getHotelIdFromPathname(pathname: string) {
  const match = stripUrlSuffix(pathname).replace(/\/+$/, '').match(/^\/hotels\/(\d+)$/);

  return match ? Number(match[1]) : null;
}

export function parseAppRoute(pathname: string, search = ''): ParsedRoute {
  const params = new URLSearchParams(search);
  const authModeParam = params.get('mode')?.toLowerCase();
  const page = getPageFromPathname(pathname);
  const hotelId = getHotelIdFromPathname(pathname);

  return {
    page,
    hotelId,
    hotels:
      page === 'hotels'
        ? normalizeHotelRouteSearch({
            city: params.get('city') ?? '',
            checkIn: params.get('checkIn') ?? '',
            checkOut: params.get('checkOut') ?? '',
            roomId: parsePositiveInt(params.get('roomId')),
            page: parsePositiveInt(params.get('page')) ?? 1,
          })
        : emptyHotelRouteSearch,
    taxi:
      page === 'taxi'
        ? normalizeTaxiRouteSearch({
            serviceId: parsePositiveInt(params.get('serviceId')),
            carClassName: params.get('class') ?? '',
          })
        : emptyTaxiRouteSearch,
    authMode: page === 'auth' && (authModeParam === 'login' || authModeParam === 'register') ? authModeParam : 'register',
  };
}

function appendHotelParams(params: URLSearchParams, search: HotelRouteSearch, includeRoom = false) {
  const normalized = normalizeHotelRouteSearch(search);

  if (normalized.city) {
    params.set('city', normalized.city);
  }

  if (normalized.checkIn) {
    params.set('checkIn', normalized.checkIn);
  }

  if (normalized.checkOut) {
    params.set('checkOut', normalized.checkOut);
  }

  if (includeRoom && normalized.roomId !== null) {
    params.set('roomId', String(normalized.roomId));
  }

  if (normalized.page > 1) {
    params.set('page', String(normalized.page));
  }
}

function withParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function buildHotelsUrl(search: Partial<HotelRouteSearch> = {}) {
  const params = new URLSearchParams();
  appendHotelParams(params, normalizeHotelRouteSearch(search));

  return withParams('/hotels', params);
}

export function buildHotelDetailUrl(hotelId: number, search: Partial<HotelRouteSearch> = {}) {
  const params = new URLSearchParams();
  appendHotelParams(params, normalizeHotelRouteSearch(search), true);

  return withParams(`/hotels/${hotelId}`, params);
}

export function buildTaxiUrl(search: Partial<TaxiRouteSearch> = {}) {
  const normalized = normalizeTaxiRouteSearch(search);
  const params = new URLSearchParams();

  if (normalized.serviceId !== null) {
    params.set('serviceId', String(normalized.serviceId));
  }

  if (normalized.carClassName) {
    params.set('class', normalized.carClassName);
  }

  return withParams('/taxi', params);
}

export function buildAuthUrl(mode: AuthMode = 'register') {
  return `/auth?mode=${mode}`;
}

export function buildParsedRouteUrl(route: ParsedRoute) {
  if (route.hotelId !== null) {
    return buildHotelDetailUrl(route.hotelId, route.hotels);
  }

  if (route.page === 'hotels') {
    return buildHotelsUrl(route.hotels);
  }

  if (route.page === 'taxi') {
    return buildTaxiUrl(route.taxi);
  }

  if (route.page === 'auth') {
    return buildAuthUrl(route.authMode);
  }

  return pageRoutes[route.page];
}
