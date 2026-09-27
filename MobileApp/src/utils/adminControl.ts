import type { AdminRide, TaxiFleet } from '../types/admin';
import type { AuthUser } from '../types/auth';

export const rideFilters = ['All', 'Waiting', 'Active', 'Completed', 'Cancelled'] as const;
export type RideFilter = typeof rideFilters[number];
export type FleetFilter = 'All' | 'With owner' | 'Without owner';

export function adminStatus(status: string) {
  return ({ AwaitingDriver: 'Waiting for driver', DriverAssigned: 'Driver on the way', DriverArrived: 'Driver arrived',
    Completed: 'Completed', Cancelled: 'Cancelled', Paid: 'Paid · legacy booking', PendingPayment: 'Payment pending · legacy booking',
  } as Record<string, string>)[status] ?? 'Status unavailable';
}

export function isActiveRide(ride: AdminRide) {
  return ride.status === 'DriverAssigned' || ride.status === 'DriverArrived';
}

export function isTerminalRide(ride: AdminRide | null) {
  return ride?.status === 'Completed' || ride?.status === 'Cancelled';
}

export function completedToday(ride: AdminRide, now = new Date()) {
  if (ride.status !== 'Completed' || !ride.completedAt) return false;
  const value = ride.completedAt;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  return !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString();
}

export function filterRides(rides: AdminRide[], filter: RideFilter, search = '', fleetId?: number, todayOnly = false, now = new Date()) {
  const term = search.trim().toLowerCase().replace(/^#/, '');
  return rides.filter((ride) => (!fleetId || ride.taxiServiceId === fleetId)
    && (!term || [String(ride.id), ride.customerName, ride.driverName ?? ''].some((value) => value.toLowerCase().includes(term)))
    && (filter === 'All' || (filter === 'Waiting' ? ride.status === 'AwaitingDriver' : filter === 'Active' ? isActiveRide(ride) : ride.status === filter))
    && (!todayOnly || completedToday(ride, now))).sort((a, b) => b.id - a.id);
}

export function filterFleets(fleets: TaxiFleet[], filter: FleetFilter, search: string) {
  const term = search.trim().toLowerCase();
  return fleets.filter((fleet) => [fleet.companyName, fleet.city].some((value) => value.toLowerCase().includes(term))
    && (filter === 'All' || (filter === 'With owner' ? fleet.ownerId != null : fleet.ownerId == null)));
}

export function canBlockAccount(user: AuthUser) {
  return user.role === 'User' || user.role === 'Admin';
}

export function getAdminErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string } | null;
  if (failure?.status === 401) return 'Your session has expired. Please sign in again.';
  if (failure?.status === 403) return 'You do not have access to this information or action.';
  if (failure?.status === 404) return 'This item is no longer available. Refresh the list.';
  if (failure?.status === 409) return 'This information has changed. Check the latest details before trying again.';
  if (!failure?.status || failure.status >= 500) return 'Connection lost. Retrying… Pull down or tap Retry to reconnect.';
  return failure.message || 'The change could not be saved. Please try again.';
}
