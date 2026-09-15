import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../../api';
import type { TaxiBooking } from '../../../types';
import { createTaxiRideSession, emptyTaxiRideState, type TaxiRideState } from './taxiRideSession';

function ride(overrides: Partial<TaxiBooking> = {}): TaxiBooking {
  return {
    id: 7, userId: 3, taxiServiceId: 1, taxiServiceName: 'Test fleet', carClassName: 'Standard',
    customerName: 'Customer', phoneNumber: '', email: '', pickupAddress: 'Pickup', dropoffAddress: 'Dropoff',
    pickupX: 0, pickupY: 0, dropoffX: 1, dropoffY: 1,
    pickupLatitude: 0, pickupLongitude: 0, dropoffLatitude: 1, dropoffLongitude: 1,
    distanceKm: 2, pricePerKm: 3, totalPrice: 6, status: 'AwaitingDriver',
    rating: null, reviewComment: null, reviewedAt: null, ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe('taxi ride session', () => {
  const sessions: ReturnType<typeof createTaxiRideSession>[] = [];

  function setup() {
    let visible = true;
    let state: TaxiRideState = emptyTaxiRideState;
    const onBookingUpdated = vi.fn();
    const onCancelled = vi.fn();
    const onChange = vi.fn((next: TaxiRideState) => { state = next; });
    const session = createTaxiRideSession({
      bookingId: 7, currentUserId: 3, isVisible: () => visible,
      onChange, onBookingUpdated, onCancelled,
    });
    sessions.push(session);
    return {
      session, onBookingUpdated, onCancelled, onChange,
      state: () => state, setVisible: (value: boolean) => { visible = value; },
    };
  }

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    sessions.splice(0).forEach((session) => session.dispose());
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches immediately and waits five seconds after a response before the next request', async () => {
    const pending = deferred<TaxiBooking>();
    const get = vi.spyOn(api, 'getTaxiBooking').mockReturnValueOnce(pending.promise).mockResolvedValue(ride());
    const test = setup();
    test.session.refresh();
    test.session.refresh();
    expect(get).toHaveBeenCalledTimes(1);
    expect(test.state().loading).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(get).toHaveBeenCalledTimes(1);
    pending.resolve(ride());
    await vi.advanceTimersByTimeAsync(0);
    expect(test.state().booking?.id).toBe(7);
    expect(test.state().loading).toBe(false);
    await vi.advanceTimersByTimeAsync(4999);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('bounds an unresponsive request at ten seconds, aborts it and retries', async () => {
    const get = vi.spyOn(api, 'getTaxiBooking')
      .mockReturnValueOnce(new Promise(() => {})).mockResolvedValue(ride());
    const test = setup();
    test.session.refresh();
    const signal = get.mock.calls[0][1];
    await vi.advanceTimersByTimeAsync(10000);
    expect(signal?.aborted).toBe(true);
    expect(test.state()).toMatchObject({ loading: false, error: 'Connection lost. Retrying…' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(get).toHaveBeenCalledTimes(2);
    expect(test.state()).toMatchObject({ error: '', booking: { id: 7 } });
  });

  it('retains the last booking when polling loses the connection', async () => {
    vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride()).mockRejectedValue(new TypeError('Offline'));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.state()).toMatchObject({ booking: { id: 7 }, loading: false, error: 'Connection lost. Retrying…' });
  });

  it.each(['Completed', 'Cancelled'] as const)('stops periodic polling for %s', async (status) => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride({ status }));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(30000);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('pauses hidden-tab polling and refreshes on returning to the page', async () => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride());
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    test.setVisible(false);
    test.session.pause();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(30000);
    expect(get).toHaveBeenCalledTimes(1);
    test.setVisible(true);
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('aborts and ignores a disposed session response, even if the request ignores abort', async () => {
    const pending = deferred<TaxiBooking>();
    const get = vi.spyOn(api, 'getTaxiBooking').mockReturnValue(pending.promise);
    const test = setup();
    test.session.refresh();
    test.session.dispose();
    const changes = test.onChange.mock.calls.length;
    expect(get.mock.calls[0][1]?.aborted).toBe(true);
    pending.resolve(ride());
    await vi.advanceTimersByTimeAsync(30000);
    expect(test.onChange).toHaveBeenCalledTimes(changes);
    expect(test.onBookingUpdated).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('ends a loading timeout while hidden without polling until the page is visible again', async () => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue(ride());
    const test = setup();
    test.session.refresh();
    test.setVisible(false);
    test.session.pause();
    await vi.advanceTimersByTimeAsync(30000);
    expect(test.state().loading).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    test.setVisible(true);
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(2);
    expect(test.state().booking?.id).toBe(7);
  });

  it('does not resurrect a cancelled ride from an older polling response', async () => {
    const pending = deferred<TaxiBooking>();
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride()).mockReturnValue(pending.promise);
    vi.spyOn(api, 'cancelTaxiBooking').mockResolvedValue(undefined);
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(5000);
    expect(get).toHaveBeenCalledTimes(2);
    await test.session.cancel();
    expect(get.mock.calls[1][1]?.aborted).toBe(true);
    expect(test.onCancelled).toHaveBeenCalledOnce();
    pending.resolve(ride({ status: 'DriverAssigned' }));
    await vi.advanceTimersByTimeAsync(30000);
    expect(test.state().booking?.status).toBe('Cancelled');
    expect(test.onBookingUpdated).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Cancelled' }));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not overlap a mutation with polling or allow duplicate mutation clicks', async () => {
    const pending = deferred<void>();
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride());
    const cancel = vi.spyOn(api, 'cancelTaxiBooking').mockReturnValue(pending.promise);
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    const mutation = test.session.cancel();
    await test.session.cancel();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(5000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(test.state().submitting).toBe(true);
    pending.resolve();
    await mutation;
    expect(test.state().submitting).toBe(false);
  });

  it('reloads the accepted ride on a cancel conflict without claiming cancellation', async () => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride())
      .mockResolvedValue(ride({ status: 'DriverAssigned' }));
    vi.spyOn(api, 'cancelTaxiBooking').mockRejectedValue(new ApiError('Conflict', 409, ''));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    await test.session.cancel();
    expect(get).toHaveBeenCalledTimes(2);
    expect(test.state().booking?.status).toBe('DriverAssigned');
    expect(test.state().error).toContain('could not be cancelled');
    expect(test.state().submitting).toBe(false);
    expect(test.onCancelled).not.toHaveBeenCalled();
  });

  it('ends a mutation timeout without claiming success and resumes active-ride refresh', async () => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride());
    const cancel = vi.spyOn(api, 'cancelTaxiBooking').mockReturnValue(new Promise(() => {}));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    const mutation = test.session.cancel();
    await vi.advanceTimersByTimeAsync(10000);
    await mutation;
    expect(cancel.mock.calls[0][1]?.aborted).toBe(true);
    expect(test.state().submitting).toBe(false);
    expect(test.state().error).toContain('could not be confirmed');
    expect(test.onCancelled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reloads the existing review on a duplicate conflict and shows it as success', async () => {
    const saved = ride({ status: 'Completed', rating: 5, reviewComment: 'Thank you' });
    vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride({ status: 'Completed' })).mockResolvedValue(saved);
    vi.spyOn(api, 'reviewTaxiBooking').mockRejectedValue(new ApiError('Already rated', 409, ''));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    await test.session.submitReview(5, 'Thank you');
    expect(test.state()).toMatchObject({ booking: saved, error: '', submitting: false });
  });

  it('retries a failed review-conflict reconciliation even though the ride is completed', async () => {
    const saved = ride({ status: 'Completed', rating: 5 });
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride({ status: 'Completed' }))
      .mockRejectedValueOnce(new TypeError('Offline')).mockResolvedValue(saved);
    vi.spyOn(api, 'reviewTaxiBooking').mockRejectedValue(new ApiError('Already rated', 409, ''));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    await test.session.submitReview(5, '');
    expect(test.state().error).toBe('Connection lost. Retrying…');
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.state()).toMatchObject({ booking: saved, error: '', submitting: false });
    await vi.advanceTimersByTimeAsync(30000);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('submits a valid owner review with a trimmed optional comment', async () => {
    const saved = ride({ status: 'Completed', rating: 4 });
    vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride({ status: 'Completed' }));
    const submit = vi.spyOn(api, 'reviewTaxiBooking').mockResolvedValue(saved);
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    await test.session.submitReview(4, '   ');
    expect(submit).toHaveBeenCalledWith(7, { rating: 4, comment: undefined }, expect.any(AbortSignal));
    expect(test.state().booking?.rating).toBe(4);
  });

  it.each([
    { status: 'AwaitingDriver' as const },
    { status: 'Completed' as const, userId: 4 },
    { status: 'Completed' as const, rating: 5 },
  ])('does not submit a review without eligibility: %j', async (overrides) => {
    vi.spyOn(api, 'getTaxiBooking').mockResolvedValue(ride(overrides));
    const submit = vi.spyOn(api, 'reviewTaxiBooking');
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(0);
    await test.session.submitReview(5, 'Thank you');
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])('clears ride data and stops polling for permanent HTTP %s', async (status) => {
    const get = vi.spyOn(api, 'getTaxiBooking').mockResolvedValueOnce(ride())
      .mockRejectedValue(new ApiError('Denied', status, ''));
    const test = setup();
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.state()).toMatchObject({ booking: null, unavailable: true, loading: false });
    test.session.refresh();
    await vi.advanceTimersByTimeAsync(30000);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
