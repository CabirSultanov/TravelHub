import { describe, expect, it } from 'vitest';
import {
  clearInvalidHotelCheckOut,
  hotelDateRangeErrorMessage,
  isHotelDateRangeValid,
  minHotelCheckOutDate,
} from './dateRange';

describe('hotel date range helpers', () => {
  it('accepts checkout after checkin', () => {
    expect(isHotelDateRangeValid('2026-09-05', '2026-09-06')).toBe(true);
  });

  it('rejects same-day and reversed checkout dates', () => {
    expect(isHotelDateRangeValid('2026-09-05', '2026-09-05')).toBe(false);
    expect(isHotelDateRangeValid('2026-09-05', '2026-08-27')).toBe(false);
  });

  it('clears checkout after checkin moves past it', () => {
    expect(clearInvalidHotelCheckOut('2026-09-05', '2026-08-27')).toBe('');
    expect(clearInvalidHotelCheckOut('2026-09-05', '2026-09-06')).toBe('2026-09-06');
    expect(minHotelCheckOutDate('2026-09-05')).toBe('2026-09-06');
    expect(hotelDateRangeErrorMessage).toBe('Check-out date must be after check-in date.');
  });
});
