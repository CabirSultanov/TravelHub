import type { DriverRideStatus } from '../types/auth';

export function formatRidePrice(amount: number) {
  return `${amount.toFixed(2)} AZN`;
}

export function formatRideDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  // Dispatch stores UTC in SQL datetime2, which may be serialized without an offset.
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  if (Number.isNaN(Date.parse(timestamp))) return 'Date unavailable';
  return new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function getDriverAction(status: DriverRideStatus) {
  if (status === 'DriverAssigned') return 'arrived';
  if (status === 'DriverArrived') return 'complete';
  return null;
}

export function getDriverStatusLabel(status: DriverRideStatus) {
  if (status === 'DriverAssigned') return 'Head to pickup';
  if (status === 'DriverArrived') return 'At pickup';
  if (status === 'Completed') return 'Ride completed';
  return 'New request';
}

export function getDriverErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string } | null;
  if (failure?.status === 401) return 'Your session has expired. Please sign in again.';
  if (failure?.status === 403) return 'Driver access is unavailable. Ask your taxi service owner to check your assignment.';
  if (failure?.status === 409) return 'This request has changed or another driver accepted it. The latest rides are being checked.';
  if (failure?.status === 0 || !failure?.status || failure.status >= 500) {
    return 'Connection lost. Your last details are still shown. Pull down or tap Retry to reconnect.';
  }
  return failure.message || 'Unable to update this ride. Please try again.';
}
