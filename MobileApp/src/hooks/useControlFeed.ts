import { useAuth } from '@/context/AuthContext';
import { canAccessControl } from '@/utils/mobileAccess';
import { getAdminErrorMessage } from '@/utils/adminControl';
import { type FeedOptions, useAuthenticatedFeed } from './useAuthenticatedFeed';

export function useControlFeed<T>(loader: (token: string, signal: AbortSignal) => Promise<T>, initial: T, options: FeedOptions<T> = {}) {
  const { user } = useAuth();
  return useAuthenticatedFeed(loader, initial, {
    poll: false, refreshAfterAction: true, ...options,
    enabled: canAccessControl(user?.role) && options.enabled !== false,
  }, getAdminErrorMessage);
}
