import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyRoomForm } from '../../features/hotels/hotels.constants';
import { saveAndRefresh } from '../../hooks/useSavedAction';
import type { Hotel } from '../../types';
import OwnerHotelEditor, { boundedOwnerRequest, OwnerRequestTimeout, ownerRoomInput, ownerRoomValidation } from './OwnerHotelEditor';

afterEach(() => { vi.useRealTimers(); });

describe('owner room editing', () => {
  it('preserves the explicit sales state and decimal price while normalizing photo URLs', () => {
    const input = ownerRoomInput(42, {
      ...createEmptyRoomForm(), roomType: ' Suite ', description: ' Sea view ', capacity: '2', totalRooms: '50',
      pricePerNight: '125.50', isAvailable: false, imageUrls: [' https://example.test/room.webp ', '', 'https://example.test/room.webp'],
    });
    expect(input).toMatchObject({ hotelId: 42, roomType: 'Suite', description: 'Sea view', capacity: 2, totalRooms: 50, pricePerNight: 125.5, isAvailable: false });
    expect(input.imageUrls).toEqual(['https://example.test/room.webp']);
    expect(input.imageUrl).toBe('https://example.test/room.webp');
    expect(ownerRoomValidation(input)).toBe('');
    expect(ownerRoomValidation({ ...input, capacity: 1.5 })).toContain('whole numbers');
    expect(ownerRoomValidation({ ...input, totalRooms: 0 })).toContain('at least 1');
    expect(ownerRoomValidation({ ...input, pricePerNight: Number.NaN })).toContain('valid price');
  });

  it('does not present an unloaded room list as empty or submit changes during render', () => {
    const onChanged = vi.fn();
    const hotel: Hotel = { id: 42, name: 'Test Hotel', city: 'Baku', description: '', imageUrls: [], roomTypesCount: 2, totalRoomsCount: 50, totalGuestPlaces: 100, averageRating: null, reviewCount: 0 };
    const html = renderToStaticMarkup(<OwnerHotelEditor hotel={hotel} onChanged={onChanged} onStateChange={() => undefined} onAccessLost={() => undefined} />);
    expect(html).toContain('Loading hotel workspace');
    expect(html).not.toContain('No room types');
    expect(html).not.toContain('Save hotel');
    expect(html).toContain('href="/hotels/42"');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('ends a hung mutation without claiming success, refreshing automatically or applying its late result', async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    const afterSave = vi.fn();
    const refresh = vi.fn();
    let unknownOutcome = false;
    const result = saveAndRefresh(async () => {
      try { await boundedOwnerRequest(write); afterSave(); }
      catch (error) { unknownOutcome = error instanceof OwnerRequestTimeout; throw error; }
    }, refresh, 'Saved.');
    await vi.advanceTimersByTimeAsync(15000);
    expect((await result).saved).toBe(false);
    expect(unknownOutcome).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    complete();
    await vi.advanceTimersByTimeAsync(0);
    expect(afterSave).not.toHaveBeenCalled();
  });

  it('ignores late photo upload URLs and stops a timed-out ownership check before more reads', async () => {
    vi.useFakeTimers();
    let completePhoto!: (value: { imageUrl: string }) => void;
    let completeOwnership!: () => void;
    const applyPhoto = vi.fn();
    const readDetails = vi.fn();
    const upload = boundedOwnerRequest(() => new Promise<{ imageUrl: string }>((resolve) => { completePhoto = resolve; }))
      .then(applyPhoto).catch((error: unknown) => error);
    const load = boundedOwnerRequest(async (signal) => {
      await new Promise<void>((resolve) => { completeOwnership = resolve; });
      if (!signal.aborted) readDetails();
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await upload).toBeInstanceOf(OwnerRequestTimeout);
    expect(await load).toBeInstanceOf(OwnerRequestTimeout);
    completePhoto({ imageUrl: 'https://example.test/late.webp' });
    completeOwnership();
    await vi.advanceTimersByTimeAsync(0);
    expect(applyPhoto).not.toHaveBeenCalled();
    expect(readDetails).not.toHaveBeenCalled();
  });
});
