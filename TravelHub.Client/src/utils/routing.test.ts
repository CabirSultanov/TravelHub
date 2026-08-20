import { describe, expect, it } from 'vitest';
import { buildAuthUrl, buildHotelsUrl, buildTaxiUrl, parseAppRoute } from './routing';

describe('routing helpers', () => {
  it('builds and parses hotel search query params', () => {
    const url = buildHotelsUrl({ city: 'Baku', checkIn: '2099-09-10', checkOut: '2099-09-12' });
    const route = parseAppRoute('/hotels', '?city=Baku&checkIn=2099-09-10&checkOut=2099-09-12');

    expect(url).toBe('/hotels?city=Baku&checkIn=2099-09-10&checkOut=2099-09-12');
    expect(route.page).toBe('hotels');
    expect(route.hotels).toMatchObject({ city: 'Baku', checkIn: '2099-09-10', checkOut: '2099-09-12' });
  });

  it('ignores invalid hotel params', () => {
    const route = parseAppRoute('/hotels/4', '?checkIn=nope&checkOut=2099-01-01&roomId=abc');

    expect(route.hotelId).toBe(4);
    expect(route.hotels.checkIn).toBe('');
    expect(route.hotels.checkOut).toBe('');
    expect(route.hotels.roomId).toBeNull();
  });

  it('keeps a direct hotel detail link and its selected room', () => {
    const route = parseAppRoute('/hotels/42', '?city=Sheki&roomId=11');

    expect(route).toMatchObject({ page: 'hotels', hotelId: 42, hotels: { city: 'Sheki', roomId: 11 } });
  });

  it('clears same-day and reversed hotel checkout params', () => {
    expect(parseAppRoute('/hotels', '?checkIn=2099-09-05&checkOut=2099-09-05').hotels.checkOut).toBe('');
    expect(parseAppRoute('/hotels', '?checkIn=2099-09-05&checkOut=2099-08-27').hotels.checkOut).toBe('');
  });

  it('builds taxi and auth URLs without private data', () => {
    expect(buildTaxiUrl({ serviceId: 3, carClassName: 'Comfort' })).toBe('/taxi?serviceId=3&class=Comfort');
    expect(buildAuthUrl('login')).toBe('/auth?mode=login');
  });

  it('parses a direct taxi service and class link', () => {
    expect(parseAppRoute('/taxi', '?serviceId=3&class=Comfort')).toMatchObject({
      page: 'taxi',
      taxi: { serviceId: 3, carClassName: 'Comfort' },
    });
  });
});
