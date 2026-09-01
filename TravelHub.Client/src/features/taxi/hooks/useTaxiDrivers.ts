import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AuthUser } from '../../../types';
import { getErrorMessage } from '../../../utils/errors';

const SEARCH_DEBOUNCE_MS = 300;

export function useTaxiDrivers({ active, taxiServiceId, setMessage, setSubmitting }: {
  active: boolean;
  taxiServiceId: number | null;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
}) {
  const [drivers, setDrivers] = useState<AuthUser[]>([]);
  const [candidates, setCandidates] = useState<AuthUser[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function load() {
    if (!active || taxiServiceId === null) {
      setDrivers([]);
      setCandidates([]);
      return;
    }

    const currentRequestId = ++requestId.current;
    try {
      const [nextDrivers, nextCandidates] = await Promise.all([
        api.getTaxiDrivers(taxiServiceId),
        api.getTaxiDriverCandidates(taxiServiceId, debouncedSearch),
      ]);
      if (currentRequestId !== requestId.current) return;
      setDrivers(nextDrivers);
      setCandidates(nextCandidates);
    } catch (error) {
      if (currentRequestId === requestId.current) setMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [active, taxiServiceId, debouncedSearch]);

  async function run(action: () => Promise<void>, message: string) {
    if (!active || taxiServiceId === null) return;
    setSubmitting(true);
    setMessage('');
    try {
      await action();
      await load();
      setMessage(message);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    drivers,
    candidates,
    search,
    setSearch,
    assign: (userId: number) => run(() => api.assignTaxiDriver(taxiServiceId!, userId), 'Driver assigned.'),
    remove: (userId: number) => run(() => api.removeTaxiDriver(taxiServiceId!, userId), 'Driver removed.'),
  };
}
