import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AuthUser, Hotel, TaxiService } from '../types';
import { getErrorMessage } from '../utils/errors';

export async function loadAllAdminHotels() {
  const first = await api.getHotels({ page: 1, pageSize: 100 });
  const hotels = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    hotels.push(...(await api.getHotels({ page, pageSize: 100 })).items);
  }
  return hotels;
}

export function useOwnerAssignments() {
  const [data, setData] = useState<{
    hotels: Hotel[]; taxiServices: TaxiService[]; hotelCandidates: AuthUser[]; taxiCandidates: AuthUser[];
  }>({ hotels: [], taxiServices: [], hotelCandidates: [], taxiCandidates: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const [hotels, taxiServices, hotelCandidates, taxiCandidates] = await Promise.all([
        loadAllAdminHotels(), api.getTaxiServices(), api.getOwnerCandidates('hotel'), api.getOwnerCandidates('taxi'),
      ]);
      if (request === revision.current) setData({ hotels, taxiServices, hotelCandidates, taxiCandidates });
    } catch (reason) {
      if (request === revision.current) setError(getErrorMessage(reason));
      throw reason;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
    return () => { revision.current += 1; };
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
