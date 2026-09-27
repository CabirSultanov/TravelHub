import { useEffect, useRef, useState } from 'react';
import type { TaxiBooking } from '../../../types';
import { createTaxiRideSession, emptyTaxiRideState, type TaxiRideState } from './taxiRideSession';

type Options = {
  bookingId: number | null;
  currentUserId: number | null;
  onBookingUpdated: (booking: TaxiBooking) => void;
  onCancelled: () => void;
};

export function useTaxiRide({ bookingId, currentUserId, onBookingUpdated, onCancelled }: Options) {
  const key = `${currentUserId}:${bookingId}`;
  const latest = useRef({ key, onBookingUpdated, onCancelled });
  latest.current = { key, onBookingUpdated, onCancelled };
  const session = useRef<{ key: string; actions: ReturnType<typeof createTaxiRideSession> } | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; state: TaxiRideState } | null>(null);

  useEffect(() => {
    setSnapshot(null);
    if (bookingId === null || currentUserId === null) return;
    const actions = createTaxiRideSession({
      bookingId,
      currentUserId,
      isVisible: () => document.visibilityState !== 'hidden',
      onChange: (state) => { if (latest.current.key === key) setSnapshot({ key, state }); },
      onBookingUpdated: (booking) => {
        if (latest.current.key === key) latest.current.onBookingUpdated(booking);
      },
      onCancelled: () => { if (latest.current.key === key) latest.current.onCancelled(); },
    });
    session.current = { key, actions };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') actions.pause();
      else actions.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', actions.refresh);
    actions.refresh();

    return () => {
      actions.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', actions.refresh);
      if (session.current?.actions === actions) session.current = null;
    };
  }, [bookingId, currentUserId, key]);

  // Hide the old user's/ride's data during the render before effect cleanup runs.
  const state = bookingId === null || currentUserId === null ? emptyTaxiRideState
    : snapshot?.key === key ? snapshot.state : { ...emptyTaxiRideState, loading: true };

  return {
    ...state,
    refresh: () => { if (session.current?.key === key) session.current.actions.refresh(); },
    cancel: async () => { if (session.current?.key === key) await session.current.actions.cancel(); },
    submitReview: async (rating: number, comment: string) => {
      if (session.current?.key === key) await session.current.actions.submitReview(rating, comment);
    },
  };
}
