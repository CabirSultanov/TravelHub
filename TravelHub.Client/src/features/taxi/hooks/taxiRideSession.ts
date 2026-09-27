import { api, ApiError } from '../../../api';
import type { TaxiBooking } from '../../../types';
import { canReviewTaxiRide, isActiveTaxiRide, isValidTaxiRideReview } from '../../../utils/taxiRide';

export type TaxiRideState = {
  booking: TaxiBooking | null;
  loading: boolean;
  error: string;
  unavailable: boolean;
  submitting: boolean;
};

export const emptyTaxiRideState: TaxiRideState = {
  booking: null, loading: false, error: '', unavailable: false, submitting: false,
};

type Options = {
  bookingId: number;
  currentUserId: number;
  isVisible: () => boolean;
  onChange: (state: TaxiRideState) => void;
  onBookingUpdated: (booking: TaxiBooking) => void;
  onCancelled: () => void;
};

// One session belongs to one ride and user. Disposing it invalidates every pending response.
export function createTaxiRideSession(options: Options) {
  let state: TaxiRideState = { ...emptyTaxiRideState };
  let disposed = false;
  let retryLoad = false;
  let version = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function update(patch: Partial<TaxiRideState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    options.onChange(state);
  }

  function pause() {
    clearTimeout(timer);
    timer = undefined;
  }

  function invalidateRequest() {
    version += 1;
    controller?.abort();
    controller = null;
    pause();
  }

  function schedule() {
    pause();
    if (!disposed && !state.unavailable && !state.submitting && options.isVisible()
      && (retryLoad || !state.booking || isActiveTaxiRide(state.booking.status))) {
      timer = setTimeout(() => void load(), 5000);
    }
  }

  async function request<T>(operation: (signal: AbortSignal) => Promise<T>) {
    const activeController = new AbortController();
    controller = activeController;
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error('Request interrupted.'));
      activeController.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timeout = setTimeout(() => activeController.abort(), 10000);

    try {
      // Bound the whole API call, including a possible authentication-refresh wait.
      return await Promise.race([operation(activeController.signal), aborted]);
    } finally {
      clearTimeout(timeout);
      activeController.signal.removeEventListener('abort', onAbort);
      if (controller === activeController) controller = null;
    }
  }

  function accept(booking: TaxiBooking, error = '') {
    retryLoad = false;
    update({ booking, error, loading: false });
    options.onBookingUpdated(booking);
  }

  function handleUnavailable(error: unknown) {
    if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) return false;
    const message = error.status === 401 ? 'Your session has expired. Please sign in again.'
      : error.status === 403 ? 'You do not have access to this ride.' : 'This ride could not be found.';
    update({ booking: null, error: message, unavailable: true, loading: false });
    pause();
    return true;
  }

  async function load(preservedError = '', afterMutation = false) {
    if (disposed || state.unavailable || controller || (state.submitting && !afterMutation)
      || (!options.isVisible() && !afterMutation)) return;
    pause();
    const currentVersion = ++version;
    update({ loading: state.booking === null });

    try {
      const booking = await request((signal) => api.getTaxiBooking(options.bookingId, signal));
      if (!disposed && version === currentVersion) accept(booking, preservedError);
    } catch (error) {
      if (!disposed && version === currentVersion && !handleUnavailable(error)) {
        retryLoad = true;
        update({ error: 'Connection lost. Retrying…', loading: false });
      }
    } finally {
      if (!disposed && version === currentVersion) schedule();
    }
  }

  async function mutate(kind: 'cancel' | 'review', rating = 0, comment = '') {
    const booking = state.booking;
    if (disposed || state.submitting || state.unavailable || !booking) return;
    if (kind === 'cancel' && booking.status !== 'AwaitingDriver') return;
    if (kind === 'review' && !canReviewTaxiRide(booking, options.currentUserId)) return;
    if (kind === 'review' && !isValidTaxiRideReview(rating, comment)) {
      update({ error: 'Choose 1 to 5 stars and keep your comment within 1000 characters.' });
      return;
    }

    invalidateRequest();
    const currentVersion = version;
    update({ submitting: true, loading: false, error: '' });

    try {
      if (kind === 'cancel') {
        await request((signal) => api.cancelTaxiBooking(options.bookingId, signal));
        if (disposed || version !== currentVersion) return;
        accept({ ...booking, status: 'Cancelled' });
        options.onCancelled();
      } else {
        const updated = await request((signal) => api.reviewTaxiBooking(options.bookingId, {
          rating, comment: comment.trim() || undefined,
        }, signal));
        if (disposed || version !== currentVersion) return;
        accept(updated);
      }
    } catch (error) {
      if (disposed || version !== currentVersion) return;
      if (error instanceof ApiError && error.status === 409) {
        await load(kind === 'cancel'
          ? 'This ride changed and could not be cancelled. Check the latest status below.'
          : 'This ride changed. Please check the latest details and try again.', true);
        if (!disposed && kind === 'review' && state.booking?.rating != null) update({ error: '' });
      } else if (!handleUnavailable(error)) {
        update({ error: error instanceof ApiError && error.status === 400 ? error.message
          : 'Connection lost. Your action could not be confirmed. Please try again.' });
      }
    } finally {
      if (!disposed) {
        update({ submitting: false });
        schedule();
      }
    }
  }

  return {
    refresh: () => { void load(); },
    pause,
    cancel: () => mutate('cancel'),
    submitReview: (rating: number, comment: string) => mutate('review', rating, comment),
    dispose: () => { disposed = true; invalidateRequest(); },
  };
}
