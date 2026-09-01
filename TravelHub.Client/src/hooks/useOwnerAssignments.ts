import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthUser, Hotel, TaxiService } from '../types';
import { getErrorMessage } from '../utils/errors';

type UseOwnerAssignmentsOptions = {
  active: boolean;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
};

export function useOwnerAssignments({ active, setMessage, setSubmitting }: UseOwnerAssignmentsOptions) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [taxiServices, setTaxiServices] = useState<TaxiService[]>([]);
  const [hotelCandidates, setHotelCandidates] = useState<AuthUser[]>([]);
  const [taxiCandidates, setTaxiCandidates] = useState<AuthUser[]>([]);

  async function load() {
    const [hotelPage, taxis, hotelUsers, taxiUsers] = await Promise.all([
      api.getHotels({ page: 1, pageSize: 100 }),
      api.getTaxiServices(),
      api.getOwnerCandidates('hotel'),
      api.getOwnerCandidates('taxi'),
    ]);

    setHotels(hotelPage.items);
    setTaxiServices(taxis);
    setHotelCandidates(hotelUsers);
    setTaxiCandidates(taxiUsers);
  }

  useEffect(() => {
    if (!active) {
      return;
    }

    void load().catch((error) => setMessage(getErrorMessage(error)));
  }, [active, setMessage]);

  async function run(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true);
    setMessage('');

    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    hotels,
    taxiServices,
    hotelCandidates,
    taxiCandidates,
    assignHotel: (hotelId: number, ownerId: number | null) =>
      run(() => api.updateHotelOwner(hotelId, ownerId), ownerId === null ? 'Hotel owner removed.' : 'Hotel owner assigned.'),
    assignTaxi: (taxiServiceId: number, ownerId: number | null) =>
      run(() => api.updateTaxiServiceOwner(taxiServiceId, ownerId), ownerId === null ? 'Taxi owner removed.' : 'Taxi owner assigned.'),
  };
}
