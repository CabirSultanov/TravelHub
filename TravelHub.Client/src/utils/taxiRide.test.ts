import { describe, expect, it } from 'vitest';
import type { TaxiBooking, TaxiBookingStatus } from '../types';
import { canReviewTaxiRide, getTaxiRideStatusLabel, isActiveTaxiRide, isValidTaxiRideReview } from './taxiRide';

describe('taxi ride display and review rules', () => {
  const completed = { status: 'Completed', userId: 4, rating: null } as TaxiBooking;

  it('only lets the booking owner review a completed, unrated ride', () => {
    expect(canReviewTaxiRide(completed, 4)).toBe(true);
    expect(canReviewTaxiRide(completed, 5)).toBe(false);
    expect(canReviewTaxiRide(completed, null)).toBe(false);
    expect(canReviewTaxiRide({ ...completed, rating: 5 }, 4)).toBe(false);
    for (const status of ['AwaitingDriver', 'DriverAssigned', 'DriverArrived', 'Cancelled', 'Paid', 'PendingPayment'] as TaxiBookingStatus[]) {
      expect(canReviewTaxiRide({ ...completed, status }, 4)).toBe(false);
    }
  });

  it('tracks unfinished rides but never calls acceptance the start of a trip', () => {
    for (const status of ['AwaitingDriver', 'DriverAssigned', 'DriverArrived'] as TaxiBookingStatus[]) {
      expect(isActiveTaxiRide(status)).toBe(true);
    }
    for (const status of ['Completed', 'Cancelled', 'Paid', 'PendingPayment'] as TaxiBookingStatus[]) {
      expect(isActiveTaxiRide(status)).toBe(false);
    }
    expect(getTaxiRideStatusLabel('DriverAssigned')).toBe('Driver on the way');
    expect(getTaxiRideStatusLabel('DriverArrived')).toBe('Driver arrived');
    expect(getTaxiRideStatusLabel('Completed')).toBe('Ride completed');
  });

  it('requires a whole star rating and limits the optional comment', () => {
    for (const rating of [1, 2, 3, 4, 5]) expect(isValidTaxiRideReview(rating, '')).toBe(true);
    for (const rating of [0, 6, 2.5, NaN]) expect(isValidTaxiRideReview(rating, '')).toBe(false);
    expect(isValidTaxiRideReview(5, 'x'.repeat(1000))).toBe(true);
    expect(isValidTaxiRideReview(5, 'x'.repeat(1001))).toBe(false);
  });
});
