import type { TaxiBooking, TaxiBookingStatus } from '../types';

export function isActiveTaxiRide(status: TaxiBookingStatus) {
  return status === 'AwaitingDriver' || status === 'DriverAssigned' || status === 'DriverArrived';
}

export function getTaxiRideStatusLabel(status: TaxiBookingStatus) {
  const labels: Record<TaxiBookingStatus, string> = {
    AwaitingDriver: 'Finding your driver',
    DriverAssigned: 'Driver on the way',
    DriverArrived: 'Driver arrived',
    Completed: 'Ride completed',
    Cancelled: 'Cancelled',
    PendingPayment: 'Awaiting payment',
    Paid: 'Paid',
  };
  return labels[status] ?? 'Ride status unavailable';
}

export function canReviewTaxiRide(booking: TaxiBooking, userId: number | null) {
  return userId !== null && booking.userId === userId && booking.status === 'Completed' && booking.rating == null;
}

export function isValidTaxiRideReview(rating: number, comment: string) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 && comment.length <= 1000;
}
