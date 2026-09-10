import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AuthUser } from '../../../types';
import { getErrorMessage } from '../../../utils/errors';
import { useSavedAction } from '../../../hooks/useSavedAction';

export function useTaxiDrivers({ active, taxiServiceId, setSubmitting }: {
  active: boolean;
  taxiServiceId: number | null;
  setSubmitting?: (submitting: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<{
    serviceId: number | null; drivers: AuthUser[]; candidates: AuthUser[]; search: string;
  }>({ serviceId: null, drivers: [], candidates: [], search: '' });
  const [query, setQuery] = useState({ serviceId: taxiServiceId, search: '' });
  const search = query.serviceId === taxiServiceId ? query.search : '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const context = useRef({ active, taxiServiceId });
  context.current = { active, taxiServiceId };
  const action = useSavedAction(setSubmitting);

  const refresh = useCallback(async () => {
    if (!active || taxiServiceId === null) return;
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const [drivers, candidates] = await Promise.all([
        api.getTaxiDrivers(taxiServiceId), api.getTaxiDriverCandidates(taxiServiceId, search.trim()),
      ]);
      if (request !== revision.current || !context.current.active || context.current.taxiServiceId !== taxiServiceId) return;
      setSnapshot({ serviceId: taxiServiceId, drivers, candidates, search });
    } catch (reason) {
      if (request === revision.current && context.current.taxiServiceId === taxiServiceId) setError(getErrorMessage(reason));
      throw reason;
    } finally {
      if (request === revision.current && context.current.taxiServiceId === taxiServiceId) setLoading(false);
    }
  }, [active, taxiServiceId, search]);

  useEffect(() => {
    setError('');
    setLoading(true);
    const timer = window.setTimeout(() => void refresh().catch(() => undefined), search ? 300 : 0);
    return () => { window.clearTimeout(timer); revision.current += 1; };
  }, [refresh]);

  const isCurrent = active && snapshot.serviceId === taxiServiceId;
  return {
    drivers: isCurrent ? snapshot.drivers : [],
    candidates: isCurrent && snapshot.search === search ? snapshot.candidates : [],
    search,
    setSearch: (value: string) => {
      if (action.busy || value === search) return;
      revision.current += 1;
      setLoading(true);
      setQuery({ serviceId: taxiServiceId, search: value });
    },
    loading: active && (loading || (!isCurrent && !error)),
    error, refresh,
    busy: action.busy, feedback: action.feedback, needsRefresh: action.needsRefresh,
    retry: () => action.retry(refresh),
    clearFeedback: action.clear,
    assign: (userId: number) => active && taxiServiceId !== null
      ? action.run(() => api.assignTaxiDriver(taxiServiceId, userId), refresh, 'Driver added to the team.')
      : Promise.resolve(false),
    remove: (userId: number) => active && taxiServiceId !== null
      ? action.run(() => api.removeTaxiDriver(taxiServiceId, userId), refresh, 'Driver assignment removed. The account was not deleted.')
      : Promise.resolve(false),
  };
}
