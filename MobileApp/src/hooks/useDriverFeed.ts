import { useAuthenticatedFeed } from './useAuthenticatedFeed';
import { getDriverErrorMessage } from '@/utils/driverRides';

export function useDriverFeed<T>(
  loader: (token: string, signal: AbortSignal) => Promise<T>,
  initialData: T,
  options: { poll?: boolean; enabled?: boolean } = {},
) {
  return useAuthenticatedFeed(loader, initialData, options, getDriverErrorMessage);
}
