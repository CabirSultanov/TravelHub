import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import HotelForm from '../../features/hotels/components/HotelForm';
import RoomForm from '../../features/hotels/components/RoomForm';
import { createEmptyHotelForm, createEmptyRoomForm, hotelToForm, roomToForm } from '../../features/hotels/hotels.constants';
import type { HotelFormActions, HotelRoomForm, RoomFormActions } from '../../features/hotels/hotels.types';
import { saveAndRefresh, type ActionFeedback } from '../../hooks/useSavedAction';
import type { Hotel, HotelRoom, HotelRoomInput, HotelUpdateInput } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { cleanImageUrls, roomImageUrls } from '../../utils/images';

type Props = {
  hotel: Hotel;
  onChanged: () => Promise<void>;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
  onAccessLost: () => void;
};

export class OwnerRequestTimeout extends Error {
  constructor() { super('The request timed out.'); this.name = 'OwnerRequestTimeout'; }
}

export async function boundedOwnerRequest<T>(action: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new OwnerRequestTimeout());
      controller.abort();
    }, 15_000);
  });
  try {
    return await Promise.race([action(controller.signal), timedOut]);
  } finally {
    clearTimeout(timeout);
  }
}

export function ownerRoomInput(hotelId: number, form: HotelRoomForm): HotelRoomInput {
  const imageUrls = cleanImageUrls(form.imageUrls);
  return {
    hotelId,
    roomType: form.roomType.trim(),
    capacity: Number(form.capacity),
    totalRooms: Number(form.totalRooms),
    pricePerNight: Number(form.pricePerNight),
    description: form.description.trim(),
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    isAvailable: form.isAvailable,
  };
}

export function ownerRoomValidation(room: HotelRoomInput) {
  if (!room.roomType || !room.description) return 'Enter a room type and description.';
  if (!Number.isSafeInteger(room.capacity) || room.capacity < 1 || !Number.isSafeInteger(room.totalRooms) || room.totalRooms < 1) {
    return 'Capacity and total rooms must be whole numbers of at least 1.';
  }
  if (!Number.isFinite(room.pricePerNight) || room.pricePerNight < 0) return 'Enter a valid price of 0 or more.';
  return '';
}

// The caller verifies ownership and keys this editor by account and hotel ID.
export default function OwnerHotelEditor({ hotel, onChanged, onStateChange, onAccessLost }: Props) {
  const [tab, setTab] = useState<'hotel' | 'rooms'>('hotel');
  const [hotelForm, setHotelForm] = useState(() => hotelToForm(hotel));
  const [savedHotelForm, setSavedHotelForm] = useState(() => hotelToForm(hotel));
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [roomForm, setRoomForm] = useState(createEmptyRoomForm);
  const [savedRoomForm, setSavedRoomForm] = useState(createEmptyRoomForm);
  const [roomEditor, setRoomEditor] = useState<number | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [deleteFailedRoom, setDeleteFailedRoom] = useState<HotelRoom | null>(null);
  const locked = useRef(true);
  const refreshRequired = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef({ onChanged, onStateChange, onAccessLost });
  callbacks.current = { onChanged, onStateChange, onAccessLost };

  const dirty = !accessLost && (JSON.stringify(hotelForm) !== JSON.stringify(savedHotelForm)
    || (roomEditor !== null && JSON.stringify(roomForm) !== JSON.stringify(savedRoomForm)));
  const pending = !accessLost && (loading || busy);
  const disabled = pending || needsRefresh || accessLost;

  useEffect(() => { callbacks.current.onStateChange({ dirty, busy: pending }); }, [dirty, pending]);

  function handleAccessError(error: unknown, request: number) {
    if (request !== generation.current || !(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) return;
    generation.current += 1;
    locked.current = true;
    setAccessLost(true);
    setRooms([]);
    setHotelForm(createEmptyHotelForm());
    setSavedHotelForm(createEmptyHotelForm());
    setRoomForm(createEmptyRoomForm());
    setSavedRoomForm(createEmptyRoomForm());
    setRoomEditor(null);
    setDeleteFailedRoom(null);
    setFeedback(null);
    callbacks.current.onStateChange({ dirty: false, busy: false });
    callbacks.current.onAccessLost();
  }

  async function reload(request: number, verifyOwnership: boolean) {
    if (request !== generation.current) return;
    try {
      const result = await boundedOwnerRequest(async (signal) => {
        if (verifyOwnership) await callbacks.current.onChanged();
        if (request !== generation.current || signal.aborted) return null;
        return Promise.all([api.getHotel(hotel.id), api.getHotelRooms(hotel.id)]);
      });
      if (!result || request !== generation.current) return;
      const [nextHotel, nextRooms] = result;
      const nextForm = hotelToForm(nextHotel);
      setHotelForm(nextForm);
      setSavedHotelForm(nextForm);
      setRooms(nextRooms);
      setLoadError('');
    } catch (error) {
      handleAccessError(error, request);
      throw error;
    }
  }

  useEffect(() => {
    const request = ++generation.current;
    locked.current = true;
    void reload(request, true).catch((error: unknown) => {
      if (request === generation.current) setLoadError(getErrorMessage(error));
    }).finally(() => {
      if (request === generation.current) { locked.current = false; setLoading(false); }
    });
    return () => { generation.current += 1; };
    // This instance is keyed by the caller; callbacks are kept current above.
  }, [hotel.id]);

  function discardChanges() {
    if (locked.current || accessLost) return false;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return false;
    setHotelForm(savedHotelForm);
    setRoomForm(createEmptyRoomForm());
    setSavedRoomForm(createEmptyRoomForm());
    setRoomEditor(null);
    callbacks.current.onStateChange({ dirty: false, busy: false });
    return true;
  }

  function editRoom(room?: HotelRoom, closeSales = false) {
    if (disabled || !discardChanges()) return;
    const nextForm = room ? roomToForm(room) : createEmptyRoomForm();
    setSavedRoomForm(nextForm);
    setRoomForm(closeSales ? { ...nextForm, isAvailable: false } : nextForm);
    setRoomEditor(room?.id ?? 'new');
    setDeleteFailedRoom(null);
    setFeedback(closeSales ? { kind: 'warning', message: 'Save this room to close new bookings. Existing reservations will remain.' } : null);
  }

  async function save(action: () => Promise<void>, afterSave: () => void, message: string) {
    if (locked.current || refreshRequired.current || accessLost) return false;
    const request = generation.current;
    locked.current = true;
    setBusy(true);
    setFeedback(null);
    setDeleteFailedRoom(null);
    let outcomeUnknown = false;
    const result = await saveAndRefresh(async () => {
      try {
        await boundedOwnerRequest(action);
        if (request === generation.current) afterSave();
      } catch (error) {
        outcomeUnknown = !(error instanceof ApiError) || error.status >= 500;
        handleAccessError(error, request);
        throw error;
      }
    }, () => reload(request, true), message);
    if (request === generation.current) {
      refreshRequired.current = outcomeUnknown || result.feedback.kind === 'warning';
      setFeedback(outcomeUnknown ? {
        kind: 'warning',
        message: 'The server did not confirm the result. The change may have been saved. Refresh the hotel and room types to check the server before making another change.',
      } : result.feedback);
      setNeedsRefresh(refreshRequired.current);
      locked.current = false;
      setBusy(false);
    }
    return outcomeUnknown ? undefined : result.saved;
  }

  async function retry() {
    if (locked.current || accessLost || !discardChanges()) return;
    const request = generation.current;
    locked.current = true;
    setBusy(true);
    try {
      await reload(request, true);
      if (request === generation.current) {
        refreshRequired.current = false;
        setNeedsRefresh(false);
        setFeedback({ kind: 'success', message: 'Hotel and room types are up to date.' });
      }
    } catch (error) {
      if (request === generation.current) setFeedback({ kind: needsRefresh ? 'warning' : 'error', message: `Could not refresh. ${getErrorMessage(error)}` });
    } finally {
      if (request === generation.current) { locked.current = false; setBusy(false); }
    }
  }

  async function submitHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || disabled) return;
    const imageUrls = cleanImageUrls(hotelForm.imageUrls);
    const input: HotelUpdateInput = {
      name: hotelForm.name.trim(), city: hotelForm.city.trim(), description: hotelForm.description.trim(),
      imageUrl: imageUrls[0] ?? null, imageUrls,
    };
    if (!input.name || !input.city) {
      setFeedback({ kind: 'error', message: 'Enter a hotel name and city.' });
      return;
    }
    await save(() => api.updateHotel(hotel.id, input), () => {
      const nextForm = { ...hotelForm, ...input, imageUrls: imageUrls.length ? imageUrls : [''] };
      setHotelForm(nextForm);
      setSavedHotelForm(nextForm);
    }, 'Hotel saved.');
  }

  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || disabled || roomEditor === null) return;
    const input = ownerRoomInput(hotel.id, roomForm);
    const error = ownerRoomValidation(input);
    if (error) { setFeedback({ kind: 'error', message: error }); return; }
    await save(async () => {
      if (roomEditor === 'new') await api.createHotelRoom(input);
      else await api.updateHotelRoom(roomEditor, input);
    }, () => {
      setSavedRoomForm(roomForm);
      setRoomEditor(null);
    }, roomEditor === 'new' ? 'Room type created.' : 'Room type saved.');
  }

  async function deleteRoom(room: HotelRoom) {
    if (disabled || locked.current) return;
    if (!window.confirm(`Delete room type "${room.roomType}"? Room types with bookings cannot be deleted. You can close new bookings instead.`)) return;
    if (!discardChanges()) return;
    const request = generation.current;
    const saved = await save(() => api.deleteHotelRoom(room.id), () => {
      setRooms((current) => current.filter((item) => item.id !== room.id));
    }, 'Room type deleted.');
    if (saved === false && request === generation.current) setDeleteFailedRoom(room);
  }

  async function upload(file: File, kind: 'hotel' | 'room') {
    if (locked.current || refreshRequired.current || disabled) return;
    const request = generation.current;
    locked.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const { imageUrl } = await boundedOwnerRequest(() => kind === 'hotel' ? api.uploadHotelImage(file) : api.uploadRoomImage(file));
      if (request !== generation.current) return;
      if (kind === 'hotel') setHotelForm((form) => ({ ...form, imageUrls: cleanImageUrls([...form.imageUrls, imageUrl]) }));
      else setRoomForm((form) => ({ ...form, imageUrls: cleanImageUrls([...form.imageUrls, imageUrl]) }));
      setFeedback({ kind: 'success', message: 'Photo uploaded. Save the form to apply it.' });
    } catch (error) {
      handleAccessError(error, request);
      if (request === generation.current) setFeedback(error instanceof OwnerRequestTimeout
        ? { kind: 'warning', message: 'Photo upload timed out. No photo was added to this form. Try again when the connection recovers.' }
        : { kind: 'error', message: `Photo upload failed. ${getErrorMessage(error)}` });
    } finally {
      if (request === generation.current) { locked.current = false; setBusy(false); }
    }
  }

  const hotelActions: HotelFormActions = {
    setForm: setHotelForm,
    submit: submitHotel,
    cancel: () => { if (discardChanges()) setFeedback(null); },
    uploadImage: (file) => { void upload(file, 'hotel'); },
    addImageUrl: () => setHotelForm({ ...hotelForm, imageUrls: [...hotelForm.imageUrls, ''] }),
    updateImageUrl: (index, imageUrl) => setHotelForm({ ...hotelForm, imageUrls: hotelForm.imageUrls.map((url, current) => current === index ? imageUrl : url) }),
    removeImageUrl: (index) => setHotelForm({ ...hotelForm, imageUrls: hotelForm.imageUrls.filter((_, current) => current !== index) }),
    // Hotel creation fields are not rendered by the shared form in edit mode.
    edit: () => undefined, updateRoom: () => undefined, addRoom: () => undefined, removeRoom: () => undefined,
    uploadRoomImage: () => undefined, updateRoomImageUrl: () => undefined, addRoomImageUrl: () => undefined, removeRoomImageUrl: () => undefined,
  };
  const roomActions: RoomFormActions = {
    setForm: setRoomForm,
    startCreate: () => editRoom(), edit: editRoom,
    submit: submitRoom,
    cancel: () => { if (discardChanges()) setFeedback(null); },
    uploadImage: (file) => { void upload(file, 'room'); },
    addImageUrl: () => setRoomForm({ ...roomForm, imageUrls: [...roomForm.imageUrls, ''] }),
    updateImageUrl: (index, imageUrl) => setRoomForm({ ...roomForm, imageUrls: roomForm.imageUrls.map((url, current) => current === index ? imageUrl : url) }),
    removeImageUrl: (index) => setRoomForm({ ...roomForm, imageUrls: roomForm.imageUrls.filter((_, current) => current !== index) }),
  };

  if (accessLost) return <p role="alert">This hotel is no longer available in your owner workspace.</p>;

  return <section className="owner-hotel-editor" aria-label="Manage selected hotel" aria-busy={pending}>
    <div className="owner-section-header"><div><p className="owner-eyebrow">{hotel.city}</p><h2>{hotel.name}</h2></div></div>
    <div className="owner-editor-header">
      <div className="owner-subtabs" role="group" aria-label="Hotel workspace sections">
        <button type="button" aria-pressed={tab === 'hotel'} disabled={pending} onClick={() => {
          if (tab !== 'hotel' && discardChanges()) { setTab('hotel'); if (!needsRefresh) setFeedback(null); }
        }}>Hotel details</button>
        <button type="button" aria-pressed={tab === 'rooms'} disabled={pending} onClick={() => {
          if (tab !== 'rooms' && discardChanges()) { setTab('rooms'); if (!needsRefresh) setFeedback(null); }
        }}>Room types</button>
      </div>
      <a href={`/hotels/${hotel.id}`} aria-disabled={pending} onClick={(event) => {
        if (!discardChanges()) event.preventDefault();
      }}>View public page</a>
    </div>

    {feedback && <div className={`owner-feedback owner-feedback-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
      <p>{feedback.message}</p>
      {deleteFailedRoom?.isAvailable && <button type="button" disabled={disabled} onClick={() => editRoom(deleteFailedRoom, true)}>
        Close new bookings for {deleteFailedRoom.roomType}
      </button>}
    </div>}
    {needsRefresh && <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void retry()}>Refresh hotel and room types</button>}
    {loading ? <p role="status">Loading hotel workspace...</p> : loadError ? <div role="alert">
      <p>Could not load the hotel workspace. {loadError}</p>
      <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void retry()}>Retry loading</button>
    </div> : tab === 'hotel' ? <fieldset className="owner-form-fieldset" disabled={disabled}>
      <legend className="sr-only">Hotel details</legend>
      <HotelForm hotelForm={hotelForm} editingHotelId={hotel.id} submitting={disabled} actions={hotelActions} />
    </fieldset> : <>
      <div className="owner-room-heading">
        <h3>{rooms.length} room {rooms.length === 1 ? 'type' : 'types'}</h3>
        <button className="small-primary-button" type="button" disabled={disabled} onClick={() => editRoom()}>Add room type</button>
      </div>
      <p className="owner-help">Keep at least 2 distinct room types and 100 guest places in total. Closing new bookings keeps existing reservations. Price changes apply only to new bookings.</p>
      {rooms.length === 0 && <p>No room types for this hotel yet.</p>}
      <div className="owner-room-list">
        {rooms.map((room) => <article className="owner-room-card" key={room.id}>
          <div className="owner-room-copy">
            <h4>{room.roomType}</h4>
            <span className={`owner-status ${room.isAvailable ? 'is-open' : 'is-closed'}`}>{room.isAvailable ? 'Open for bookings' : 'Closed for new bookings'}</span>
            <p>Capacity: {room.capacity} guests · Total rooms: {room.totalRooms} · {room.pricePerNight.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} / night</p>
            {room.description && <p>{room.description}</p>}
            <div className="owner-room-photos">{roomImageUrls(room).map((url, index) => <img key={url} src={url} alt={`${room.roomType} photo ${index + 1}`} loading="lazy" />)}</div>
          </div>
          <div className="card-actions">
            <button className="btn btn-secondary" type="button" disabled={disabled} onClick={() => editRoom(room)}>Edit room type</button>
            <button className="btn owner-danger" type="button" disabled={disabled} onClick={() => void deleteRoom(room)}>Delete room type</button>
          </div>
        </article>)}
      </div>
      {roomEditor !== null && <fieldset className="owner-form-fieldset" disabled={disabled}>
        <legend className="sr-only">{roomEditor === 'new' ? 'New room type' : 'Edit room type'}</legend>
        <label className="owner-availability-toggle">
          <input type="checkbox" checked={roomForm.isAvailable} onChange={(event) => setRoomForm({ ...roomForm, isAvailable: event.target.checked })} />
          {roomForm.isAvailable ? 'Open for bookings' : 'Closed for new bookings'}
        </label>
        <p className="owner-help">Closing new bookings preserves existing reservations. Save the room to apply this setting.</p>
        <RoomForm roomForm={roomForm} editingRoomId={roomEditor === 'new' ? null : roomEditor} submitting={disabled} actions={roomActions} />
      </fieldset>}
    </>}
  </section>;
}
