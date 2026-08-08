import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import ConfirmDeleteModal from './components/common/ConfirmDeleteModal';
import PaymentFormComponent from './components/booking/PaymentForm';
import SiteHeader from './components/common/SiteHeader';
import AdminPage from './pages/Admin/AdminPage';
import AuthPage from './pages/Auth/AuthPage';
import HomePage from './pages/Home/HomePage';
import HotelsPage from './pages/Hotels/HotelsPage';
import PlacesPage from './pages/Places/PlacesPage';
import ProfilePage from './pages/Profile/ProfilePage';
import TaxiPage from './pages/Taxi/TaxiPage';
import { formatTaxiCarClassName } from './utils/formatting';
import { cleanImageUrls, fallbackImage, roomImageUrls } from './utils/images';
import { calculateTaxiDistanceKm, clamp, splitTaxiCities, taxiCarClassOptions } from './utils/taxi';
import type {
  AuthForm,
  AuthMode,
  AuthUser,
  Booking,
  BookingForm,
  BookingGuestMode,
  BookingPayment,
  DeleteTarget,
  Hotel,
  HotelForm,
  HotelInput,
  HotelRoom,
  HotelRoomForm,
  HotelUpdateInput,
  Page,
  PaymentCardForm,
  PaymentCardCreate,
  PaymentForm,
  PaymentMode,
  Place,
  ProfileForm,
  SavedPaymentCard,
  TaxiBooking,
  TaxiBookingForm,
  TaxiCarClassForm,
  TaxiService,
  TaxiForm,
  TaxiServiceInput,
  TaxiPointMode,
} from './types';

const appPages: Page[] = ['home', 'taxi', 'hotels', 'places', 'auth', 'admin', 'profile'];
const pageRoutes: Record<Page, string> = {
  home: '/',
  taxi: '/taxi',
  hotels: '/hotels',
  places: '/places',
  auth: '/auth',
  admin: '/admin',
  profile: '/profile',
};


const phoneNumberPattern = String.raw`\+?[0-9\s()-]{7,30}`;
const accountPhonePrefix = '+994';
const accountPhonePattern = String.raw`[0-9\s()-]{9,30}`;
const pricePattern = String.raw`[0-9]+(\.[0-9]{1,2})?`;
const cardNumberPattern = String.raw`[0-9\s]{16,23}`;
const cvvPattern = String.raw`[0-9]{3,4}`;
const currentYear = new Date().getFullYear();

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const emptyBookingForm: BookingForm = {
  customerName: '',
  phoneNumber: '',
  email: '',
  checkInDate: today,
  checkOutDate: tomorrow,
};

const emptyPaymentForm: PaymentForm = {
  savedPaymentCardId: '',
  cardNumber: '',
  cardHolderName: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
  saveCard: false,
};

const emptyPaymentCardForm: PaymentCardForm = {
  cardNumber: '',
  cardHolderName: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
};

const emptyAuthForm: AuthForm = {
  name: '',
  email: '',
  phoneNumber: '',
  password: '',
};

const emptyProfileForm: ProfileForm = {
  name: '',
  phoneNumber: '',
};

function createEmptyRoomForm(): HotelRoomForm {
  return {
    roomType: '',
    capacity: '1',
    totalRooms: '1',
    pricePerNight: '1',
    description: '',
    imageUrls: [''],
    isAvailable: true,
  };
}

function createEmptyHotelForm(): HotelForm {
  return {
    name: '',
    city: '',
    description: '',
    imageUrl: '',
    rooms: [
      { ...createEmptyRoomForm(), roomType: 'Standard Double', capacity: '2', totalRooms: '30' },
      { ...createEmptyRoomForm(), roomType: 'Family Suite', capacity: '4', totalRooms: '10' },
    ],
  };
}

function hotelToForm(hotel: Hotel): HotelForm {
  return {
    name: hotel.name,
    city: hotel.city,
    description: hotel.description,
    imageUrl: hotel.imageUrl || '',
    rooms: createEmptyHotelForm().rooms,
  };
}

function roomToForm(room: HotelRoom): HotelRoomForm {
  const imageUrls = roomImageUrls(room);

  return {
    roomType: room.roomType,
    capacity: String(room.capacity),
    totalRooms: String(room.totalRooms),
    pricePerNight: String(room.pricePerNight),
    description: room.description,
    imageUrls: imageUrls.length > 0 ? imageUrls : [''],
    isAvailable: room.isAvailable,
  };
}

function withHotelRoomStats(hotel: Hotel, hotelRooms: HotelRoom[]): Hotel {
  return {
    ...hotel,
    roomTypesCount: hotelRooms.length,
    totalRoomsCount: hotelRooms.reduce((total, room) => total + room.totalRooms, 0),
    totalGuestPlaces: hotelRooms.reduce((total, room) => total + room.capacity * room.totalRooms, 0),
  };
}

const emptyTaxiForm: TaxiForm = {
  companyName: '',
  cities: [''],
  phoneNumber: '',
  description: '',
  imageUrl: '',
  carClasses: [{ name: 'Standard', pricePerKm: '' }],
};

function createEmptyTaxiBookingForm(user?: AuthUser | null, taxiService?: TaxiService): TaxiBookingForm {
  return {
    taxiServiceId: String(taxiService?.id ?? ''),
    carClassName: taxiService?.carClasses[0]?.name ?? '',
    customerName: user?.name ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    email: user?.email ?? '',
    pickupAddress: 'Airport terminal',
    dropoffAddress: 'City center',
    pickupX: 22,
    pickupY: 68,
    dropoffX: 76,
    dropoffY: 34,
  };
}

function App() {
  const [page, setPage] = useState<Page>(() => getPageFromPathname(window.location.pathname));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [taxiServices, setTaxiServices] = useState<TaxiService[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AuthUser[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [taxiBooking, setTaxiBooking] = useState<TaxiBooking | null>(null);
  const [taxiBookings, setTaxiBookings] = useState<TaxiBooking[]>([]);
  const [savedPaymentCards, setSavedPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [hotelForm, setHotelForm] = useState<HotelForm>(createEmptyHotelForm);
  const [editingHotelId, setEditingHotelId] = useState<number | null>(null);
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [roomForm, setRoomForm] = useState<HotelRoomForm>(createEmptyRoomForm);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [taxiForm, setTaxiForm] = useState<TaxiForm>(emptyTaxiForm);
  const [taxiBookingForm, setTaxiBookingForm] = useState<TaxiBookingForm>(() => createEmptyTaxiBookingForm());
  const [taxiPointMode, setTaxiPointMode] = useState<TaxiPointMode>('pickup');
  const [editingTaxiId, setEditingTaxiId] = useState<number | null>(null);
  const [showTaxiForm, setShowTaxiForm] = useState(false);
  const [bookingGuestMode, setBookingGuestMode] = useState<BookingGuestMode>('self');
  const [taxiBookingGuestMode, setTaxiBookingGuestMode] = useState<BookingGuestMode>('self');
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('new');
  const [paymentCardForm, setPaymentCardForm] = useState<PaymentCardForm>(emptyPaymentCardForm);
  const [showPaymentCardForm, setShowPaymentCardForm] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState<number | null>(null);
  const [payingTaxiBookingId, setPayingTaxiBookingId] = useState<number | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [taxiBookingsLoading, setTaxiBookingsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const selectedHotelIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [hotelData, taxiData, placeData] = await Promise.all([
          api.getHotels(),
          api.getTaxiServices(),
          api.getPlaces(),
        ]);
        setHotels(hotelData);
        setTaxiServices(taxiData);
        setPlaces(placeData);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
    void api.getMe().then(setCurrentUser).catch(() => undefined);
  }, []);

  useEffect(() => {
    const currentPage = getPageFromPathname(window.location.pathname);
    window.history.replaceState({ page: currentPage }, '', pageRoutes[currentPage]);

    function handleBrowserBack() {
      setPage(getPageFromPathname(window.location.pathname));
    }

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, []);

  useEffect(() => {
    if (page !== 'admin' || currentUser?.role !== 'SuperAdmin') {
      return;
    }

    void loadAdminLists();
  }, [currentUser?.role, page]);

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setTaxiBooking(null);
      setTaxiBookings([]);
      setSavedPaymentCards([]);
      setPayingTaxiBookingId(null);
      setTaxiBookingGuestMode('self');
      setTaxiBookingForm(createEmptyTaxiBookingForm());
      return;
    }

    void loadBookings();
    void loadTaxiBookings();
    void loadPaymentCards();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!taxiBookingForm.taxiServiceId) {
      return;
    }

    if (taxiServices.some((taxiService) => taxiService.id === Number(taxiBookingForm.taxiServiceId))) {
      return;
    }

    setTaxiBookingForm((form) => ({
      ...form,
      taxiServiceId: '',
      carClassName: '',
    }));
    setTaxiBooking(null);
  }, [taxiBookingForm.taxiServiceId, taxiServices]);

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

  useEffect(() => {
    if (!currentUser || taxiBookingGuestMode !== 'self') {
      return;
    }

    setTaxiBookingForm((form) => ({
      ...form,
      customerName: currentUser.name,
      phoneNumber: currentUser.phoneNumber,
      email: currentUser.email,
    }));
  }, [taxiBookingGuestMode, currentUser?.email, currentUser?.name, currentUser?.phoneNumber]);

  const cities = useMemo(() => {
    return Array.from(new Set(hotels.map((hotel) => hotel.city))).sort((a, b) => a.localeCompare(b));
  }, [hotels]);

  const visibleHotels = useMemo(() => {
    if (!cityFilter) {
      return hotels;
    }

    return hotels.filter((hotel) => hotel.city === cityFilter);
  }, [cityFilter, hotels]);

  const selectedTaxiService = useMemo(
    () => taxiServices.find((taxiService) => taxiService.id === Number(taxiBookingForm.taxiServiceId)) ?? null,
    [taxiBookingForm.taxiServiceId, taxiServices],
  );
  const selectedTaxiCarClass =
    selectedTaxiService?.carClasses.find((carClass) => carClass.name === taxiBookingForm.carClassName) ??
    selectedTaxiService?.carClasses[0] ??
    null;
  const taxiDistanceKm = calculateTaxiDistanceKm(
    taxiBookingForm.pickupX,
    taxiBookingForm.pickupY,
    taxiBookingForm.dropoffX,
    taxiBookingForm.dropoffY,
  );
  const taxiEstimatedTotal = selectedTaxiCarClass ? taxiDistanceKm * selectedTaxiCarClass.pricePerKm : 0;

  const canManageTaxi = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';
  const canManageHotels = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  function navigateTo(nextPage: Page) {
    setPage(nextPage);
    const nextPath = pageRoutes[nextPage];

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ page: nextPage }, '', nextPath);
    }
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
        setHotelForm(createEmptyHotelForm());
        setEditingHotelId(null);
        setShowHotelForm(false);
        return;
      }

      const rooms = hotelForm.rooms.map((room) => ({
        roomType: room.roomType.trim(),
        capacity: Number(room.capacity),
        totalRooms: Number(room.totalRooms),
        pricePerNight: Number(room.pricePerNight),
        description: room.description.trim(),
        imageUrls: cleanImageUrls(room.imageUrls),
        isAvailable: room.isAvailable,
      }));
      const roomTypes = new Set(rooms.map((room) => room.roomType.toLowerCase()).filter(Boolean));
      const guestCapacity = rooms.reduce((total, room) => total + room.capacity * room.totalRooms, 0);

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
        rooms,
      };
      const createdHotel = await api.createHotel(hotel);
      let createdRooms = await api.getHotelRooms(createdHotel.id);

      if (createdRooms.length === 0) {
        createdRooms = [];

        for (const room of rooms) {
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
        setSelectedRoom(hotelRooms.find((hotelRoom) => hotelRoom.id === editingRoomId) ?? null);
        setMessage('Room updated.');
      } else {
        const createdRoom = await api.createHotelRoom(room);
        const hotelRooms = [...rooms, createdRoom];
        setRooms(hotelRooms);
        syncHotelRoomStats(selectedHotel, hotelRooms);
        setMessage('Room added.');
      }

      setEditingRoomId(null);
      setRoomForm(createEmptyRoomForm());
      setShowRoomForm(false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function updateHotelFormRoom(index: number, room: Partial<HotelRoomForm>) {
    setHotelForm({
      ...hotelForm,
      rooms: hotelForm.rooms.map((currentRoom, currentIndex) =>
        currentIndex === index ? { ...currentRoom, ...room } : currentRoom,
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
    setSelectedRoom(room);
    setShowRoomForm(true);
    setMessage('');
  }

  function syncHotelRoomStats(hotel: Hotel, hotelRooms: HotelRoom[]) {
    const updatedHotel = withHotelRoomStats(hotel, hotelRooms);

    setHotels((currentHotels) =>
      currentHotels.map((currentHotel) => (currentHotel.id === updatedHotel.id ? updatedHotel : currentHotel)),
    );
    setSelectedHotel((currentHotel) => (currentHotel?.id === updatedHotel.id ? updatedHotel : currentHotel));
  }

  async function deleteSelectedItem() {
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

  async function submitTaxiService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageTaxi) {
      return;
    }

    const taxiService: TaxiServiceInput = {
      companyName: taxiForm.companyName.trim(),
      city: taxiForm.cities.map((city) => city.trim()).filter(Boolean).join(', '),
      phoneNumber: taxiForm.phoneNumber.trim(),
      description: taxiForm.description.trim(),
      imageUrl: taxiForm.imageUrl?.trim() || null,
      carClasses: taxiForm.carClasses.map((carClass) => ({
        name: carClass.name.trim(),
        pricePerKm: Number(carClass.pricePerKm),
      })),
    };

    setSubmitting(true);
    setMessage('');

    try {
      if (editingTaxiId) {
        const updatedTaxiService = await api.updateTaxiService(editingTaxiId, taxiService);
        setTaxiServices(taxiServices.map((taxi) => (taxi.id === editingTaxiId ? updatedTaxiService : taxi)));
        setMessage('Taxi service updated.');
      } else {
        const createdTaxiService = await api.createTaxiService(taxiService);
        setTaxiServices([...taxiServices, createdTaxiService]);
        setMessage('Taxi service created.');
      }

      setTaxiForm(emptyTaxiForm);
      setEditingTaxiId(null);
      setShowTaxiForm(false);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function editTaxiService(taxiService: TaxiService) {
    setEditingTaxiId(taxiService.id);
    setTaxiForm({
      companyName: taxiService.companyName,
      cities: splitTaxiCities(taxiService.city),
      phoneNumber: taxiService.phoneNumber,
      description: taxiService.description,
      imageUrl: taxiService.imageUrl || '',
      carClasses:
        taxiService.carClasses.length > 0
          ? taxiService.carClasses.map((carClass) => ({
              name: carClass.name,
              pricePerKm: String(carClass.pricePerKm),
            }))
          : emptyTaxiForm.carClasses,
    });
    setShowTaxiForm(true);
    setMessage('');
  }

  function updateTaxiCity(index: number, city: string) {
    setTaxiForm({
      ...taxiForm,
      cities: taxiForm.cities.map((currentCity, currentIndex) => (currentIndex === index ? city : currentCity)),
    });
  }

  function removeTaxiCity(index: number) {
    if (taxiForm.cities.length === 1) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      cities: taxiForm.cities.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  function updateTaxiCarClass(index: number, carClass: Partial<TaxiCarClassForm>) {
    setTaxiForm({
      ...taxiForm,
      carClasses: taxiForm.carClasses.map((currentCarClass, currentIndex) =>
        currentIndex === index ? { ...currentCarClass, ...carClass } : currentCarClass,
      ),
    });
  }

  function removeTaxiCarClass(index: number) {
    if (taxiForm.carClasses.length === 1) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      carClasses: taxiForm.carClasses.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  function addTaxiCarClass() {
    const selectedNames = new Set(taxiForm.carClasses.map((carClass) => carClass.name));
    const nextOption = taxiCarClassOptions.find((option) => !selectedNames.has(option.value));

    if (!nextOption) {
      return;
    }

    setTaxiForm({
      ...taxiForm,
      carClasses: [...taxiForm.carClasses, { name: nextOption.value, pricePerKm: '' }],
    });
  }

  async function deleteTaxiService(taxiServiceId: number) {
    if (!canManageTaxi || !window.confirm('Delete this taxi service?')) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.deleteTaxiService(taxiServiceId);
      setTaxiServices(taxiServices.filter((taxi) => taxi.id !== taxiServiceId));
      setEditingTaxiId(null);
      setShowTaxiForm(false);
      setTaxiForm(emptyTaxiForm);
      setMessage('Taxi service deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function selectTaxiServiceForBooking(taxiService: TaxiService) {
    setTaxiBookingForm({
      ...taxiBookingForm,
      taxiServiceId: String(taxiService.id),
      carClassName: taxiService.carClasses[0]?.name ?? '',
    });
    setTaxiBooking(null);
    setPayingTaxiBookingId(null);
    setEditingTaxiId(null);
    setTaxiForm(emptyTaxiForm);
    setShowTaxiForm(false);
    setMessage('');
  }

  function updateTaxiMapPoint(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);

    setTaxiBookingForm({
      ...taxiBookingForm,
      [taxiPointMode === 'pickup' ? 'pickupX' : 'dropoffX']: Number(x.toFixed(1)),
      [taxiPointMode === 'pickup' ? 'pickupY' : 'dropoffY']: Number(y.toFixed(1)),
    });
  }

  async function submitTaxiBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setAuthMode('login');
      navigateTo('auth');
      setMessage('Please sign in to order a taxi.');
      return;
    }

    if (!selectedTaxiService || !selectedTaxiCarClass) {
      setMessage('Choose a taxi service and car class.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const createdBooking = await api.createTaxiBooking({
        taxiServiceId: Number(taxiBookingForm.taxiServiceId),
        carClassName: selectedTaxiCarClass.name,
        customerName: taxiBookingForm.customerName,
        phoneNumber: taxiBookingForm.phoneNumber,
        email: taxiBookingForm.email,
        pickupAddress: taxiBookingForm.pickupAddress,
        dropoffAddress: taxiBookingForm.dropoffAddress,
        pickupX: taxiBookingForm.pickupX,
        pickupY: taxiBookingForm.pickupY,
        dropoffX: taxiBookingForm.dropoffX,
        dropoffY: taxiBookingForm.dropoffY,
      });

      setTaxiBooking(createdBooking);
      upsertTaxiBooking(createdBooking);
      resetPaymentForm();
      setMessage('Taxi booking created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function loadBookings() {
    setBookingsLoading(true);

    try {
      setBookings(await api.getBookings(true));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBookingsLoading(false);
    }
  }

  async function loadTaxiBookings() {
    setTaxiBookingsLoading(true);

    try {
      setTaxiBookings(await api.getTaxiBookings(true));
    } catch (error) {
      if (!getErrorMessage(error).includes('status 404')) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      setTaxiBookingsLoading(false);
    }
  }

  async function loadPaymentCards() {
    try {
      const cards = await api.getPaymentCards();
      setSavedPaymentCards(cards);
      setPaymentForm((form) => ({
        ...form,
        savedPaymentCardId: form.savedPaymentCardId || String(cards[0]?.id ?? ''),
      }));
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function upsertBooking(nextBooking: Booking) {
    setBookings((currentBookings) => [
      nextBooking,
      ...currentBookings.filter((currentBooking) => currentBooking.id !== nextBooking.id),
    ]);
  }

  function upsertTaxiBooking(nextBooking: TaxiBooking) {
    setTaxiBookings((currentBookings) => [
      nextBooking,
      ...currentBookings.filter((currentBooking) => currentBooking.id !== nextBooking.id),
    ]);
  }

  function selectBookingGuestMode(mode: BookingGuestMode) {
    setBookingGuestMode(mode);
    setBookingForm((form) => ({
      ...form,
      customerName: mode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: mode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: mode === 'self' && currentUser ? currentUser.email : '',
    }));
  }

  function selectTaxiBookingGuestMode(mode: BookingGuestMode) {
    setTaxiBookingGuestMode(mode);
    setTaxiBookingForm((form) => ({
      ...form,
      customerName: mode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: mode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: mode === 'self' && currentUser ? currentUser.email : '',
    }));
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setAuthMode('login');
      navigateTo('auth');
      setMessage('Please sign in to create a booking.');
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
      upsertBooking(createdBooking);
      resetPaymentForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function createPaymentPayload(): BookingPayment {
    return paymentMode === 'saved' && savedPaymentCards.length > 0
      ? {
          savedPaymentCardId: Number(paymentForm.savedPaymentCardId),
          saveCard: false,
        }
      : {
          cardNumber: paymentForm.cardNumber,
          cardHolderName: paymentForm.cardHolderName,
          expiryMonth: Number(paymentForm.expiryMonth),
          expiryYear: Number(paymentForm.expiryYear),
          cvv: paymentForm.cvv,
          saveCard: paymentForm.saveCard,
        };
  }

  async function submitBookingPayment(event: FormEvent<HTMLFormElement>, targetBooking: Booking) {
    event.preventDefault();

    setSubmitting(true);
    setPaymentProcessing(true);
    setMessage('');

    try {
      const payment = createPaymentPayload();
      await delay(3000);
      const paidBooking = await api.payBooking(targetBooking.id, payment);

      if (booking?.id === paidBooking.id) {
        setBooking(paidBooking);
      }

      if (paymentMode === 'new' && paymentForm.saveCard) {
        await loadPaymentCards();
      }

      upsertBooking(paidBooking);
      resetPaymentForm();
      setPayingBookingId(null);
      setMessage('Payment completed.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
      setPaymentProcessing(false);
    }
  }

  async function submitTaxiBookingPayment(event: FormEvent<HTMLFormElement>, targetBooking: TaxiBooking) {
    event.preventDefault();

    setSubmitting(true);
    setPaymentProcessing(true);
    setMessage('');

    try {
      const payment = createPaymentPayload();
      await delay(3000);
      const paidBooking = await api.payTaxiBooking(targetBooking.id, payment);

      if (taxiBooking?.id === paidBooking.id) {
        setTaxiBooking(paidBooking);
      }

      if (paymentMode === 'new' && paymentForm.saveCard) {
        await loadPaymentCards();
      }

      upsertTaxiBooking(paidBooking);
      resetPaymentForm();
      setPayingTaxiBookingId(null);
      setMessage('Payment completed.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
      setPaymentProcessing(false);
    }
  }

  async function cancelBooking(targetBooking: Booking) {
    setSubmitting(true);
    setMessage('');

    try {
      await api.cancelBooking(targetBooking.id);

      const cancelledBooking: Booking = {
        ...targetBooking,
        status: 'Cancelled',
        cancelledAt: new Date().toISOString(),
      };

      if (booking?.id === targetBooking.id) {
        setBooking(cancelledBooking);
      }

      upsertBooking(cancelledBooking);
      setPayingBookingId(null);
      setMessage('Booking cancelled.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelTaxiBooking(targetBooking: TaxiBooking) {
    setSubmitting(true);
    setMessage('');

    try {
      await api.cancelTaxiBooking(targetBooking.id);

      const cancelledBooking: TaxiBooking = {
        ...targetBooking,
        status: 'Cancelled',
        cancelledAt: new Date().toISOString(),
      };

      if (taxiBooking?.id === targetBooking.id) {
        setTaxiBooking(cancelledBooking);
      }

      upsertTaxiBooking(cancelledBooking);
      setPayingTaxiBookingId(null);
      setMessage('Taxi booking cancelled.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const user =
        authMode === 'register'
          ? await api.register({ ...authForm, phoneNumber: toAzerbaijanPhoneNumber(authForm.phoneNumber) })
          : await api.login({ email: authForm.email, password: authForm.password });

      setCurrentUser(user);
      setAuthForm(emptyAuthForm);
      setMessage(authMode === 'register' ? 'Registration completed.' : 'Logged in.');
      navigateTo('home');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    setSubmitting(true);
    setMessage('');

    try {
      await api.logout();
      setCurrentUser(null);
      setBooking(null);
      setBookings([]);
      setSavedPaymentCards([]);
      setPaymentCardForm(emptyPaymentCardForm);
      setShowPaymentCardForm(false);
      setPayingBookingId(null);
      setEditingProfile(false);
      navigateTo('home');
      setMessage('Logged out.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteProfile() {
    if (!window.confirm('Delete your profile? This cannot be undone.')) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.deleteProfile();
      setCurrentUser(null);
      setBooking(null);
      setBookings([]);
      setSavedPaymentCards([]);
      setPaymentCardForm(emptyPaymentCardForm);
      setShowPaymentCardForm(false);
      setPayingBookingId(null);
      setEditingProfile(false);
      navigateTo('home');
      setMessage('Profile deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openProfileEditor() {
    if (!currentUser) {
      return;
    }

    setProfileForm({
      name: currentUser.name,
      phoneNumber: stripAzerbaijanPhonePrefix(currentUser.phoneNumber),
    });
    setEditingProfile(true);
    setMessage('');
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const updatedUser = await api.updateProfile({
        name: profileForm.name.trim(),
        phoneNumber: toAzerbaijanPhoneNumber(profileForm.phoneNumber),
      });

      setCurrentUser(updatedUser);
      setEditingProfile(false);
      setMessage('Profile updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPaymentCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const createdCard = await api.createPaymentCard(toPaymentCardCreate(paymentCardForm));
      setSavedPaymentCards([createdCard, ...savedPaymentCards]);
      setPaymentCardForm(emptyPaymentCardForm);
      setShowPaymentCardForm(false);
      setMessage('Card saved.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePaymentCard(cardId: number) {
    if (!window.confirm('Delete this saved card?')) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.deletePaymentCard(cardId);
      const nextCards = savedPaymentCards.filter((card) => card.id !== cardId);
      setSavedPaymentCards(nextCards);

      if (paymentForm.savedPaymentCardId === String(cardId)) {
        setPaymentForm({
          ...paymentForm,
          savedPaymentCardId: String(nextCards[0]?.id ?? ''),
        });
        setPaymentMode(nextCards.length > 0 ? paymentMode : 'new');
      }

      setMessage('Card deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openAuth() {
    setAuthMode('register');
    navigateTo('auth');
    setMessage('');
  }

  async function loadAdminLists() {
    try {
      const [adminData, userData] = await Promise.all([api.getAdmins(), api.getAdminCandidates()]);
      setAdmins(adminData);
      setAdminCandidates(userData);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function promoteToAdmin(userId: number) {
    setSubmitting(true);
    setMessage('');

    try {
      const admin = await api.promoteUserToAdmin(userId);
      setAdminCandidates(adminCandidates.filter((user) => user.id !== userId));
      setAdmins([...admins, admin]);
      setMessage('User promoted to admin.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function demoteAdmin(userId: number) {
    setSubmitting(true);
    setMessage('');

    try {
      await api.demoteAdminToUser(userId);
      const admin = admins.find((user) => user.id === userId);
      setAdmins(admins.filter((user) => user.id !== userId));

      if (admin) {
        setAdminCandidates([...adminCandidates, { ...admin, role: 'User' }]);
      }

      setMessage('Admin demoted to user.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function blockUser(userId: number) {
    setSubmitting(true);
    setMessage('');

    try {
      const blockedUser = await api.blockUser(userId);
      setAdmins(admins.map((user) => (user.id === userId ? blockedUser : user)));
      setAdminCandidates(adminCandidates.map((user) => (user.id === userId ? blockedUser : user)));
      setMessage('User blocked.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function unblockUser(userId: number) {
    setSubmitting(true);
    setMessage('');

    try {
      const unblockedUser = await api.unblockUser(userId);
      setAdmins(admins.map((user) => (user.id === userId ? unblockedUser : user)));
      setAdminCandidates(adminCandidates.map((user) => (user.id === userId ? unblockedUser : user)));
      setMessage('User unblocked.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAccount(userId: number) {
    setSubmitting(true);
    setMessage('');

    try {
      await api.deleteAccount(userId);
      setAdmins(admins.filter((user) => user.id !== userId));
      setAdminCandidates(adminCandidates.filter((user) => user.id !== userId));
      setMessage('Account deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setSelectedRoom(null);
    setBooking(null);
    setBookingForm({
      ...emptyBookingForm,
      customerName: bookingGuestMode === 'self' && currentUser ? currentUser.name : '',
      phoneNumber: bookingGuestMode === 'self' && currentUser ? currentUser.phoneNumber : '',
      email: bookingGuestMode === 'self' && currentUser ? currentUser.email : '',
    });
    setPaymentForm(emptyPaymentForm);
    setPayingBookingId(null);
    setMessage('');
  }

  function resetTaxiBookingFlow() {
    setTaxiBooking(null);
    setTaxiBookingForm(createEmptyTaxiBookingForm(currentUser, selectedTaxiService ?? taxiServices[0]));
    setPayingTaxiBookingId(null);
    setMessage('');
  }

  function resetPaymentForm() {
    setPaymentMode(savedPaymentCards.length > 0 ? 'saved' : 'new');
    setPaymentForm({
      ...emptyPaymentForm,
      savedPaymentCardId: String(savedPaymentCards[0]?.id ?? ''),
    });
  }

  function openPaymentForm(bookingId: number) {
    setPayingBookingId(bookingId);
    setPayingTaxiBookingId(null);
    resetPaymentForm();
  }

  function openTaxiPaymentForm(bookingId: number) {
    setPayingTaxiBookingId(bookingId);
    setPayingBookingId(null);
    resetPaymentForm();
  }

  function toPaymentCardCreate(form: PaymentCardForm): PaymentCardCreate {
    return {
      cardNumber: form.cardNumber,
      cardHolderName: form.cardHolderName,
      expiryMonth: Number(form.expiryMonth),
      expiryYear: Number(form.expiryYear),
      cvv: form.cvv,
    };
  }

  function renderPaymentForm(targetBooking: Booking | TaxiBooking, bookingKind: 'hotel' | 'taxi' = 'hotel') {
    return (
      <PaymentFormComponent
        cardNumberPattern={cardNumberPattern}
        currentYear={currentYear}
        cvvPattern={cvvPattern}
        onCancel={() => {
          if (bookingKind === 'taxi') {
            void cancelTaxiBooking(targetBooking as TaxiBooking);
          } else {
            void cancelBooking(targetBooking as Booking);
          }
        }}
        onPaymentFormChange={setPaymentForm}
        onPaymentModeChange={setPaymentMode}
        onSubmit={(event) => {
          if (bookingKind === 'taxi') {
            void submitTaxiBookingPayment(event, targetBooking as TaxiBooking);
          } else {
            void submitBookingPayment(event, targetBooking as Booking);
          }
        }}
        paymentForm={paymentForm}
        paymentMode={paymentMode}
        savedPaymentCards={savedPaymentCards}
        submitting={submitting}
      />
    );
  }

  return (
    <main className="app">
      <SiteHeader
        currentUser={currentUser}
        onLogout={logout}
        onNavigate={navigateTo}
        onOpenAuth={openAuth}
        page={page}
        submitting={submitting}
      />

      {message && <div className="notice">{message}</div>}

      {paymentProcessing && (
        <div className="payment-processing-overlay" role="status" aria-live="polite">
          <div className="payment-processing-panel">
            <span className="payment-processing-spinner" aria-hidden="true" />
            <strong>Processing payment...</strong>
          </div>
        </div>
      )}

      {page === 'home' && <HomePage onNavigate={navigateTo} />}

      {page === 'taxi' && (
        <TaxiPage
          canManageTaxi={canManageTaxi}
          currentUser={currentUser}
          editingTaxiId={editingTaxiId}
          loading={loading}
          onAddTaxiCarClass={addTaxiCarClass}
          onAddTaxiCity={() => setTaxiForm({ ...taxiForm, cities: [...taxiForm.cities, ''] })}
          onCancelTaxiForm={() => {
            setTaxiForm(emptyTaxiForm);
            setEditingTaxiId(null);
            setShowTaxiForm(false);
          }}
          onDeleteTaxiService={(taxiServiceId) => void deleteTaxiService(taxiServiceId)}
          onEditTaxiService={editTaxiService}
          onOpenAuth={openAuth}
          onRemoveTaxiCarClass={removeTaxiCarClass}
          onRemoveTaxiCity={removeTaxiCity}
          onResetTaxiBookingFlow={resetTaxiBookingFlow}
          onSelectTaxiBookingGuestMode={selectTaxiBookingGuestMode}
          onSelectTaxiService={selectTaxiServiceForBooking}
          onSetTaxiPointMode={setTaxiPointMode}
          onSubmitTaxiBooking={(event) => void submitTaxiBooking(event)}
          onSubmitTaxiService={(event) => void submitTaxiService(event)}
          onTaxiBookingFormChange={(form) => setTaxiBookingForm(form)}
          onTaxiFormChange={(form) => setTaxiForm(form)}
          onUpdateTaxiCarClass={updateTaxiCarClass}
          onUpdateTaxiCity={updateTaxiCity}
          onUpdateTaxiMapPoint={updateTaxiMapPoint}
          onStartCreateTaxiService={() => {
            setTaxiForm(emptyTaxiForm);
            setEditingTaxiId(null);
            setShowTaxiForm(true);
          }}
          phoneNumberPattern={phoneNumberPattern}
          pricePattern={pricePattern}
          renderPaymentForm={renderPaymentForm}
          selectedTaxiCarClass={selectedTaxiCarClass}
          selectedTaxiService={selectedTaxiService}
          showTaxiForm={showTaxiForm}
          submitting={submitting}
          taxiBooking={taxiBooking}
          taxiBookingForm={taxiBookingForm}
          taxiBookingGuestMode={taxiBookingGuestMode}
          taxiDistanceKm={taxiDistanceKm}
          taxiEstimatedTotal={taxiEstimatedTotal}
          taxiForm={taxiForm}
          taxiPointMode={taxiPointMode}
          taxiServices={taxiServices}
        />
      )}

      {page === 'hotels' && (
        <HotelsPage
          booking={booking}
          bookingForm={bookingForm}
          bookingGuestMode={bookingGuestMode}
          canManageHotels={canManageHotels}
          cities={cities}
          cityFilter={cityFilter}
          currentUser={currentUser}
          editingHotelId={editingHotelId}
          editingRoomId={editingRoomId}
          hotelForm={hotelForm}
          loading={loading}
          onAddHotelFormRoom={addHotelFormRoom}
          onAddHotelRoomImageUrl={addHotelRoomImageUrl}
          onAddRoomImageUrl={addRoomImageUrl}
          onBookingFormChange={(form) => setBookingForm(form)}
          onCancelHotelForm={() => {
            setHotelForm(createEmptyHotelForm());
            setEditingHotelId(null);
            setShowHotelForm(false);
          }}
          onCancelRoomForm={() => {
            setEditingRoomId(null);
            setShowRoomForm(false);
            setRoomForm(createEmptyRoomForm());
          }}
          onCityFilterChange={(city) => setCityFilter(city)}
          onEditHotel={editHotel}
          onEditHotelRoom={editHotelRoom}
          onHotelFormChange={(form) => setHotelForm(form)}
          onOpenAuth={openAuth}
          onRemoveHotelFormRoom={removeHotelFormRoom}
          onRemoveHotelRoomImageUrl={removeHotelRoomImageUrl}
          onRemoveRoomImageUrl={removeRoomImageUrl}
          onResetFlow={resetFlow}
          onRoomFormChange={(form) => setRoomForm(form)}
          onSelectBookingGuestMode={selectBookingGuestMode}
          onSelectHotel={(hotel) => void selectHotel(hotel)}
          onSelectRoom={(room) => setSelectedRoom(room)}
          onSetDeleteTarget={(target) => setDeleteTarget(target)}
          onStartCreateHotel={() => {
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
          }}
          onStartCreateRoom={() => {
            setEditingRoomId(null);
            setRoomForm(createEmptyRoomForm());
            setShowRoomForm(true);
            setSelectedRoom(null);
            setBooking(null);
          }}
          onSubmitBooking={(event) => void submitBooking(event)}
          onSubmitHotel={(event) => void submitHotel(event)}
          onSubmitHotelRoom={(event) => void submitHotelRoom(event)}
          onUpdateHotelFormRoom={updateHotelFormRoom}
          onUpdateHotelRoomImageUrl={updateHotelRoomImageUrl}
          onUpdateRoomImageUrl={updateRoomImageUrl}
          phoneNumberPattern={phoneNumberPattern}
          renderPaymentForm={renderPaymentForm}
          roomForm={roomForm}
          rooms={rooms}
          roomsLoading={roomsLoading}
          selectedHotel={selectedHotel}
          selectedRoom={selectedRoom}
          showHotelForm={showHotelForm}
          showRoomForm={showRoomForm}
          submitting={submitting}
          visibleHotels={visibleHotels}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteSelectedItem}
          submitting={submitting}
          target={deleteTarget}
        />
      )}

      {page === 'places' && <PlacesPage fallbackImage={fallbackImage} loading={loading} places={places} />}

      {page === 'auth' && (
        <AuthPage
          accountPhonePattern={accountPhonePattern}
          accountPhonePrefix={accountPhonePrefix}
          authForm={authForm}
          authMode={authMode}
          onAuthFormChange={setAuthForm}
          onSubmit={(event) => void submitAuth(event)}
          onToggleMode={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
          submitting={submitting}
        />
      )}

      {page === 'profile' && currentUser && (
        <ProfilePage
          accountPhonePattern={accountPhonePattern}
          accountPhonePrefix={accountPhonePrefix}
          bookings={bookings}
          bookingsLoading={bookingsLoading}
          cardNumberPattern={cardNumberPattern}
          currentUser={currentUser}
          currentYear={currentYear}
          cvvPattern={cvvPattern}
          editingProfile={editingProfile}
          formatTaxiCarClassName={formatTaxiCarClassName}
          onCancelBooking={cancelBooking}
          onCancelPaymentCardForm={() => {
            setPaymentCardForm(emptyPaymentCardForm);
            setShowPaymentCardForm(false);
          }}
          onCancelProfileEdit={() => setEditingProfile(false)}
          onCancelTaxiBooking={cancelTaxiBooking}
          onDeletePaymentCard={deletePaymentCard}
          onDeleteProfile={deleteProfile}
          onOpenPaymentForm={openPaymentForm}
          onOpenProfileEditor={openProfileEditor}
          onOpenTaxiPaymentForm={openTaxiPaymentForm}
          onPaymentCardFormChange={setPaymentCardForm}
          onProfileFormChange={setProfileForm}
          onShowPaymentCardForm={setShowPaymentCardForm}
          onSubmitPaymentCard={(event) => void submitPaymentCard(event)}
          onSubmitProfile={(event) => void submitProfile(event)}
          payingBookingId={payingBookingId}
          payingTaxiBookingId={payingTaxiBookingId}
          paymentCardForm={paymentCardForm}
          renderPaymentForm={renderPaymentForm}
          savedPaymentCards={savedPaymentCards}
          profileForm={profileForm}
          showPaymentCardForm={showPaymentCardForm}
          submitting={submitting}
          taxiBookings={taxiBookings}
          taxiBookingsLoading={taxiBookingsLoading}
        />
      )}

      {page === 'admin' && currentUser?.role === 'SuperAdmin' && (
        <AdminPage
          adminCandidates={adminCandidates}
          admins={admins}
          onBlock={blockUser}
          onDelete={deleteAccount}
          onDemote={demoteAdmin}
          onPromote={promoteToAdmin}
          onUnblock={unblockUser}
          submitting={submitting}
        />
      )}
    </main>
  );
}

function toAzerbaijanPhoneNumber(phoneNumber: string) {
  return `${accountPhonePrefix} ${stripAzerbaijanPhonePrefix(phoneNumber)}`.trim();
}

function stripAzerbaijanPhonePrefix(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  return trimmed.startsWith(accountPhonePrefix) ? trimmed.slice(accountPhonePrefix.length).trim() : trimmed;
}

function getPageFromPathname(pathname: string): Page {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  return appPages.find((currentPage) => pageRoutes[currentPage] === cleanPath) ?? 'home';
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error.';
}

export default App;
