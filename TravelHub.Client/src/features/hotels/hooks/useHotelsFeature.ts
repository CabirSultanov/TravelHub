import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../api';
import { getErrorMessage } from '../../../utils/errors';
import { cleanImageUrls } from '../../../utils/images';
import type { Booking, Hotel, HotelInput, HotelRoom, HotelUpdateInput } from '../../../types';
import {
  createEmptyHotelForm,
  createEmptyRoomForm,
  emptyBookingForm,
  hotelToForm,
  roomToForm,
  withHotelRoomStats,
} from '../hotels.constants';
import type { BookingForm, HotelForm, HotelRoomForm, HotelsFeature, HotelsFeatureOptions } from '../hotels.types';

export function useHotelsFeature({
  currentUser,
  setMessage,
  setSubmitting,
  onRequireAuth,
  onBookingCreated,
  onResetPayment,
  onResetBookingFlow,
}: HotelsFeatureOptions): HotelsFeature {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [hotelForm, setHotelForm] = useState<HotelForm>(createEmptyHotelForm);
  const [editingHotelId, setEditingHotelId] = useState<number | null>(null);
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [roomForm, setRoomForm] = useState<HotelRoomForm>(createEmptyRoomForm);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [bookingGuestMode, setBookingGuestMode] = useState<'self' | 'other'>('self');
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [cityFilter, setCityFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<import('../../../types').DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const selectedHotelIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadHotels() {
      try {
        setHotels(await api.getHotels());
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void loadHotels();
  }, [setMessage]);

  useEffect(() => {
    if (!currentUser || bookingGuestMode !== 'self') {
      return;
    }

    setBookingForm((form) => ({
      ...form,
      customerName: currentUser.name,
      phoneNumber: currentUser.phoneNumber,
      email: currentUser.email,
    }));
  }, [bookingGuestMode, currentUser?.email, currentUser?.name, currentUser?.phoneNumber]);

  const cities = useMemo(() => {
    return Array.from(new Set(hotels.map((hotel) => hotel.city))).sort((a, b) => a.localeCompare(b));
  }, [hotels]);

  const visibleHotels = useMemo(() => {
    if (!cityFilter) {
      return hotels;
    }

    return hotels.filter((hotel) => hotel.city === cityFilter);
  }, [cityFilter, hotels]);

  const canManageHotels = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  function startCreateHotel() {
    setHotelForm(createEmptyHotelForm());
    setEditingHotelId(null);
    setShowHotelForm(true);
    setSelectedHotel(null);
    selectedHotelIdRef.current = null;
    setSelectedRoom(null);
    setBooking(null);
    setRooms([]);
    setRoomsLoading(false);
    setEditingRoomId(null);
    setShowRoomForm(false);
    setRoomForm(createEmptyRoomForm());
  }

  function startCreateRoom() {
    setEditingRoomId(null);
    setRoomForm(createEmptyRoomForm());
    setShowRoomForm(true);
    setSelectedRoom(null);
    setBooking(null);
  }

  function cancelHotelForm() {
    setHotelForm(createEmptyHotelForm());
    setEditingHotelId(null);
    setShowHotelForm(false);
  }

  function cancelRoomForm() {
    setEditingRoomId(null);
    setShowRoomForm(false);
    setRoomForm(createEmptyRoomForm());
  }

  function syncHotelRoomStats(hotel: Hotel, hotelRooms: HotelRoom[]) {
    const updatedHotel = withHotelRoomStats(hotel, hotelRooms);

    setHotels((currentHotels) =>
      currentHotels.map((currentHotel) => (currentHotel.id === updatedHotel.id ? updatedHotel : currentHotel)),
    );
    setSelectedHotel((currentHotel) => (currentHotel?.id === updatedHotel.id ? updatedHotel : currentHotel));
  }

  async function selectHotel(hotel: Hotel) {
    const hotelId = hotel.id;

    selectedHotelIdRef.current = hotelId;
    setSelectedHotel(hotel);
    setSelectedRoom(null);
    setBooking(null);
    setEditingHotelId(null);
    setEditingRoomId(null);
    setShowHotelForm(false);
    setShowRoomForm(false);
    setRoomForm(createEmptyRoomForm());
    setMessage('');
    setRooms([]);
    setRoomsLoading(true);

    try {
      const hotelRooms = await api.getHotelRooms(hotelId);

      if (selectedHotelIdRef.current === hotelId) {
        setRooms(hotelRooms);
        syncHotelRoomStats(hotel, hotelRooms);
      }
    } catch (error) {
      if (selectedHotelIdRef.current === hotelId) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      if (selectedHotelIdRef.current === hotelId) {
        setRoomsLoading(false);
      }
    }
  }

  async function submitHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageHotels) {
      return;
    }

    const hotelDetails: HotelUpdateInput = {
      name: hotelForm.name.trim(),
      city: hotelForm.city.trim(),
      description: hotelForm.description.trim(),
      imageUrl: hotelForm.imageUrl.trim() || null,
    };

    setSubmitting(true);
    setMessage('');

    try {
      if (editingHotelId !== null) {
        await api.updateHotel(editingHotelId, hotelDetails);
        const previousHotel = hotels.find((hotel) => hotel.id === editingHotelId) ?? selectedHotel;
        const updatedHotel: Hotel = {
          id: editingHotelId,
          ...hotelDetails,
          roomTypesCount: previousHotel?.roomTypesCount ?? 0,
          totalRoomsCount: previousHotel?.totalRoomsCount ?? 0,
          totalGuestPlaces: previousHotel?.totalGuestPlaces ?? 0,
        };

        setHotels(hotels.map((hotel) => (hotel.id === editingHotelId ? updatedHotel : hotel)));

        if (selectedHotel?.id === editingHotelId) {
          setSelectedHotel(updatedHotel);
        }

        setMessage('Hotel updated.');
        cancelHotelForm();
        return;
      }

      const hotelRooms = hotelForm.rooms.map((room) => ({
        roomType: room.roomType.trim(),
        capacity: Number(room.capacity),
        totalRooms: Number(room.totalRooms),
        pricePerNight: Number(room.pricePerNight),
        description: room.description.trim(),
        imageUrls: cleanImageUrls(room.imageUrls),
        isAvailable: room.isAvailable,
      }));
      const roomTypes = new Set(hotelRooms.map((room) => room.roomType.toLowerCase()).filter(Boolean));
      const guestCapacity = hotelRooms.reduce((total, room) => total + room.capacity * room.totalRooms, 0);

      if (roomTypes.size < 2) {
        setMessage('Add at least 2 room types.');
        return;
      }

      if (guestCapacity < 100) {
        setMessage('Hotel rooms must fit at least 100 guests.');
        return;
      }

      const hotel: HotelInput = {
        ...hotelDetails,
        rooms: hotelRooms,
      };
      const createdHotel = await api.createHotel(hotel);
      let createdRooms = await api.getHotelRooms(createdHotel.id);

      if (createdRooms.length === 0) {
        createdRooms = [];

        for (const room of hotelRooms) {
          createdRooms.push(
            await api.createHotelRoom({
              hotelId: createdHotel.id,
              imageUrl: room.imageUrls[0] ?? null,
              ...room,
            }),
          );
        }
      }

      setHotels([...hotels, createdHotel]);
      setHotelForm(createEmptyHotelForm());
      setEditingHotelId(null);
      setShowHotelForm(false);
      selectedHotelIdRef.current = createdHotel.id;
      setSelectedHotel(createdHotel);
      setSelectedRoom(null);
      setBooking(null);
      setShowRoomForm(false);
      setRoomForm(createEmptyRoomForm());
      setRooms(createdRooms);
      setRoomsLoading(false);
      setMessage('Hotel created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitHotelRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageHotels || !selectedHotel) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const room = {
        hotelId: selectedHotel.id,
        roomType: roomForm.roomType.trim(),
        capacity: Number(roomForm.capacity),
        totalRooms: Number(roomForm.totalRooms),
        pricePerNight: Number(roomForm.pricePerNight),
        description: roomForm.description.trim(),
        imageUrl: cleanImageUrls(roomForm.imageUrls)[0] ?? null,
        imageUrls: cleanImageUrls(roomForm.imageUrls),
        isAvailable: roomForm.isAvailable,
      };

      if (editingRoomId !== null) {
        await api.updateHotelRoom(editingRoomId, room);
        const hotelRooms = await api.getHotelRooms(selectedHotel.id);
        setRooms(hotelRooms);
        syncHotelRoomStats(selectedHotel, hotelRooms);
        setSelectedRoom(null);
        setMessage('Room updated.');
      } else {
        const createdRoom = await api.createHotelRoom(room);
        const hotelRooms = [...rooms, createdRoom];
        setRooms(hotelRooms);
        syncHotelRoomStats(selectedHotel, hotelRooms);
        setMessage('Room added.');
      }

      cancelRoomForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function updateHotelFormRoom(index: number, update: Partial<HotelRoomForm>) {
    setHotelForm({
      ...hotelForm,
      rooms: hotelForm.rooms.map((currentRoom, currentIndex) =>
        currentIndex === index ? { ...currentRoom, ...update } : currentRoom,
      ),
    });
  }

  function addHotelFormRoom() {
    setHotelForm({
      ...hotelForm,
      rooms: [...hotelForm.rooms, createEmptyRoomForm()],
    });
  }

  function removeHotelFormRoom(index: number) {
    if (hotelForm.rooms.length <= 2) {
      return;
    }

    setHotelForm({
      ...hotelForm,
      rooms: hotelForm.rooms.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  async function uploadHotelImage(file: File) {
    if (!canManageHotels) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const { imageUrl } = await api.uploadHotelImage(file);
      setHotelForm((form) => ({ ...form, imageUrl }));
      setMessage('Hotel image uploaded.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function addImageUrlToList(imageUrls: string[], imageUrl: string) {
    const emptyIndex = imageUrls.findIndex((currentUrl) => currentUrl.trim() === '');

    if (emptyIndex === -1) {
      return [...imageUrls, imageUrl];
    }

    return imageUrls.map((currentUrl, currentIndex) => (currentIndex === emptyIndex ? imageUrl : currentUrl));
  }

  async function uploadHotelRoomImage(roomIndex: number, file: File) {
    if (!canManageHotels) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const { imageUrl } = await api.uploadRoomImage(file);
      setHotelForm((form) => ({
        ...form,
        rooms: form.rooms.map((room, currentIndex) =>
          currentIndex === roomIndex ? { ...room, imageUrls: addImageUrlToList(room.imageUrls, imageUrl) } : room,
        ),
      }));
      setMessage('Room image uploaded.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function updateHotelRoomImageUrl(roomIndex: number, imageIndex: number, imageUrl: string) {
    const room = hotelForm.rooms[roomIndex];

    if (!room) {
      return;
    }

    updateHotelFormRoom(roomIndex, {
      imageUrls: room.imageUrls.map((currentUrl, currentIndex) => (currentIndex === imageIndex ? imageUrl : currentUrl)),
    });
  }

  function addHotelRoomImageUrl(roomIndex: number) {
    const room = hotelForm.rooms[roomIndex];

    if (!room) {
      return;
    }

    updateHotelFormRoom(roomIndex, { imageUrls: [...room.imageUrls, ''] });
  }

  function removeHotelRoomImageUrl(roomIndex: number, imageIndex: number) {
    const room = hotelForm.rooms[roomIndex];

    if (!room || room.imageUrls.length <= 1) {
      return;
    }

    updateHotelFormRoom(roomIndex, {
      imageUrls: room.imageUrls.filter((_, currentIndex) => currentIndex !== imageIndex),
    });
  }

  function editHotel(hotel: Hotel) {
    setEditingHotelId(hotel.id);
    setHotelForm(hotelToForm(hotel));
    setShowHotelForm(true);
    setEditingRoomId(null);
    setShowRoomForm(false);
    setRoomForm(createEmptyRoomForm());
    setMessage('');
  }

  function editHotelRoom(room: HotelRoom) {
    setEditingRoomId(room.id);
    setRoomForm(roomToForm(room));
    setSelectedRoom(null);
    setBooking(null);
    setShowRoomForm(true);
    setMessage('');
  }

  function updateRoomImageUrl(index: number, imageUrl: string) {
    setRoomForm({
      ...roomForm,
      imageUrls: roomForm.imageUrls.map((currentUrl, currentIndex) => (currentIndex === index ? imageUrl : currentUrl)),
    });
  }

  function addRoomImageUrl() {
    setRoomForm({
      ...roomForm,
      imageUrls: [...roomForm.imageUrls, ''],
    });
  }

  function removeRoomImageUrl(index: number) {
    if (roomForm.imageUrls.length <= 1) {
      return;
    }

    setRoomForm({
      ...roomForm,
      imageUrls: roomForm.imageUrls.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  async function uploadRoomImage(file: File) {
    if (!canManageHotels) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const { imageUrl } = await api.uploadRoomImage(file);
      setRoomForm((form) => ({ ...form, imageUrls: addImageUrlToList(form.imageUrls, imageUrl) }));
      setMessage('Room image uploaded.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function selectBookingGuestMode(mode: 'self' | 'other') {
    setBookingGuestMode(mode);
    setBookingForm((form) => ({
      ...form,
      customerName: mode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: mode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: mode === 'self' && currentUser ? currentUser.email : '',
    }));
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      onRequireAuth('Please sign in to create a booking.');
      return;
    }

    if (!selectedRoom) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const createdBooking = await api.createBooking({
        ...bookingForm,
        hotelRoomId: selectedRoom.id,
      });

      setBooking(createdBooking);
      onBookingCreated(createdBooking);
      onResetPayment();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setSelectedRoom(null);
    setBooking(null);
    setBookingForm({
      ...emptyBookingForm,
      customerName: bookingGuestMode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: bookingGuestMode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: bookingGuestMode === 'self' && currentUser ? currentUser.email : '',
    });
    onResetBookingFlow();
    setMessage('');
  }

  async function confirmDelete() {
    if (!canManageHotels || !deleteTarget) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      if (deleteTarget.kind === 'hotel') {
        await api.deleteHotel(deleteTarget.id);
        setHotels(hotels.filter((hotel) => hotel.id !== deleteTarget.id));

        if (selectedHotel?.id === deleteTarget.id) {
          setSelectedHotel(null);
          selectedHotelIdRef.current = null;
          setSelectedRoom(null);
          setBooking(null);
          setRooms([]);
          setRoomsLoading(false);
          setEditingHotelId(null);
          setEditingRoomId(null);
          setShowRoomForm(false);
          setRoomForm(createEmptyRoomForm());
        }

        setMessage('Hotel deleted.');
      } else {
        await api.deleteHotelRoom(deleteTarget.id);
        const hotelRooms = rooms.filter((room) => room.id !== deleteTarget.id);
        setRooms(hotelRooms);

        if (selectedHotel) {
          syncHotelRoomStats(selectedHotel, hotelRooms);
        }

        if (selectedRoom?.id === deleteTarget.id) {
          setSelectedRoom(null);
          setBooking(null);
        }

        if (editingRoomId === deleteTarget.id) {
          setEditingRoomId(null);
          setShowRoomForm(false);
          setRoomForm(createEmptyRoomForm());
        }

        setMessage('Room deleted.');
      }

      setDeleteTarget(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    model: {
      hotels,
      visibleHotels,
      cities,
      rooms,
      selectedHotel,
      selectedRoom,
      booking,
      hotelForm,
      roomForm,
      bookingForm,
      cityFilter,
      editingHotelId,
      editingRoomId,
      showHotelForm,
      showRoomForm,
      roomsLoading,
      canManageHotels,
      bookingGuestMode,
      deleteTarget,
      loading,
    },
    actions: {
      hotelList: {
        startCreate: startCreateHotel,
        select: (hotel) => void selectHotel(hotel),
        setCityFilter,
        requestDelete: setDeleteTarget,
      },
      hotelForm: {
        setForm: setHotelForm,
        edit: editHotel,
        updateRoom: updateHotelFormRoom,
        addRoom: addHotelFormRoom,
        removeRoom: removeHotelFormRoom,
        uploadImage: (file) => void uploadHotelImage(file),
        uploadRoomImage: (roomIndex, file) => void uploadHotelRoomImage(roomIndex, file),
        updateRoomImageUrl: updateHotelRoomImageUrl,
        addRoomImageUrl: addHotelRoomImageUrl,
        removeRoomImageUrl: removeHotelRoomImageUrl,
        submit: (event) => void submitHotel(event),
        cancel: cancelHotelForm,
      },
      roomList: {
        select: setSelectedRoom,
        edit: editHotelRoom,
        requestDelete: setDeleteTarget,
      },
      roomForm: {
        setForm: setRoomForm,
        startCreate: startCreateRoom,
        edit: editHotelRoom,
        updateImageUrl: updateRoomImageUrl,
        uploadImage: (file) => void uploadRoomImage(file),
        addImageUrl: addRoomImageUrl,
        removeImageUrl: removeRoomImageUrl,
        submit: (event) => void submitHotelRoom(event),
        cancel: cancelRoomForm,
      },
      booking: {
        setForm: setBookingForm,
        selectGuestMode: selectBookingGuestMode,
        submit: (event) => void submitBooking(event),
        reset: resetBooking,
        setBooking,
      },
      delete: {
        cancel: () => setDeleteTarget(null),
        confirm: confirmDelete,
      },
    },
  };
}
