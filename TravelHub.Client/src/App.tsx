import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type {
  AuthUser,
  Booking,
  BookingCreate,
  BookingPayment,
  Hotel,
  HotelRoom,
  HotelRoomInput,
  Place,
  TaxiService,
  TaxiServiceInput,
} from './types';

type Page = 'home' | 'taxi' | 'hotels' | 'places' | 'auth' | 'admin' | 'profile';
type AuthMode = 'login' | 'register';
type BookingGuestMode = 'self' | 'other';

const appPages: Page[] = ['home', 'taxi', 'hotels', 'places', 'auth', 'admin', 'profile'];

type BookingForm = Omit<BookingCreate, 'hotelRoomId' | 'guestsCount'> & {
  guestsCount: string;
};

type PaymentForm = Omit<BookingPayment, 'expiryMonth' | 'expiryYear'> & {
  expiryMonth: string;
  expiryYear: string;
};

type AuthForm = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
};

type ProfileForm = {
  name: string;
  phoneNumber: string;
};

type HotelRoomForm = Omit<HotelRoomInput, 'hotelId' | 'capacity' | 'totalRooms' | 'pricePerNight'> & {
  capacity: string;
  totalRooms: string;
  pricePerNight: string;
};

type DeleteTarget = {
  kind: 'hotel' | 'room';
  id: number;
  name: string;
};

type TaxiCarClassForm = {
  name: string;
  pricePerKm: string;
};

type TaxiForm = Omit<TaxiServiceInput, 'city' | 'carClasses'> & {
  cities: string[];
  carClasses: TaxiCarClassForm[];
};

const taxiCarClassOptions = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Priority', label: 'Priority' },
  { value: 'Comfort', label: 'Comfort' },
  { value: 'Business', label: 'Business' },
  { value: 'Green', label: 'Green' },
  { value: 'XL', label: 'XL' },
];
const phoneNumberPattern = String.raw`\+?[0-9\s()-]{7,30}`;
const accountPhonePrefix = '+994';
const accountPhonePattern = String.raw`[0-9\s()-]{9,30}`;
const pricePattern = String.raw`[0-9]+(\.[0-9]{1,2})?`;

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const emptyBookingForm: BookingForm = {
  customerName: '',
  phoneNumber: '',
  email: '',
  checkInDate: today,
  checkOutDate: tomorrow,
  guestsCount: '1',
};

const emptyPaymentForm: PaymentForm = {
  cardNumber: '',
  cardHolderName: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
  saveCard: false,
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

const emptyRoomForm: HotelRoomForm = {
  roomType: '',
  capacity: '1',
  totalRooms: '1',
  pricePerNight: '1',
  description: '',
  imageUrl: '',
  isAvailable: true,
};

const emptyTaxiForm: TaxiForm = {
  companyName: '',
  cities: [''],
  phoneNumber: '',
  description: '',
  imageUrl: '',
  carClasses: [{ name: 'Standard', pricePerKm: '' }],
};

function App() {
  const [page, setPage] = useState<Page>('home');
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
  const [roomForm, setRoomForm] = useState<HotelRoomForm>(emptyRoomForm);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [taxiForm, setTaxiForm] = useState<TaxiForm>(emptyTaxiForm);
  const [editingTaxiId, setEditingTaxiId] = useState<number | null>(null);
  const [showTaxiForm, setShowTaxiForm] = useState(false);
  const [bookingGuestMode, setBookingGuestMode] = useState<BookingGuestMode>('self');
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [payingBookingId, setPayingBookingId] = useState<number | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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
    if (!isPage(window.history.state?.page)) {
      window.history.replaceState({ page }, '', window.location.href);
    }

    function handleBrowserBack(event: PopStateEvent) {
      const nextPage = isPage(event.state?.page) ? event.state.page : 'home';
      setPage(nextPage);
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
      return;
    }

    void loadBookings();
  }, [currentUser?.id]);

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

  const canManageTaxi = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';
  const canManageHotels = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  function navigateTo(nextPage: Page) {
    setPage(nextPage);

    if (window.history.state?.page !== nextPage) {
      window.history.pushState({ page: nextPage }, '', window.location.href);
    }
  }

  async function selectHotel(hotel: Hotel) {
    setSelectedHotel(hotel);
    setSelectedRoom(null);
    setBooking(null);
    setShowRoomForm(false);
    setRoomForm(emptyRoomForm);
    setMessage('');
    setRooms([]);

    try {
      setRooms(await api.getHotelRooms(hotel.id));
    } catch (error) {
      setMessage(getErrorMessage(error));
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
      const createdRoom = await api.createHotelRoom({
        hotelId: selectedHotel.id,
        roomType: roomForm.roomType.trim(),
        capacity: Number(roomForm.capacity),
        totalRooms: Number(roomForm.totalRooms),
        pricePerNight: Number(roomForm.pricePerNight),
        description: roomForm.description.trim(),
        imageUrl: roomForm.imageUrl?.trim() || null,
        isAvailable: roomForm.isAvailable,
      });

      setRooms([...rooms, createdRoom]);
      setRoomForm(emptyRoomForm);
      setShowRoomForm(false);
      setMessage('Room added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
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
          setSelectedRoom(null);
          setBooking(null);
          setRooms([]);
          setShowRoomForm(false);
          setRoomForm(emptyRoomForm);
        }

        setMessage('Hotel deleted.');
      } else {
        await api.deleteHotelRoom(deleteTarget.id);
        setRooms(rooms.filter((room) => room.id !== deleteTarget.id));

        if (selectedRoom?.id === deleteTarget.id) {
          setSelectedRoom(null);
          setBooking(null);
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

  function upsertBooking(nextBooking: Booking) {
    setBookings((currentBookings) => [
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
        guestsCount: Number(bookingForm.guestsCount),
      });

      setBooking(createdBooking);
      upsertBooking(createdBooking);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBookingPayment(event: FormEvent<HTMLFormElement>, targetBooking: Booking) {
    event.preventDefault();

    setSubmitting(true);
    setMessage('Processing payment...');

    try {
      await delay(1800);
      const paidBooking = await api.payBooking(targetBooking.id, {
        ...paymentForm,
        expiryMonth: Number(paymentForm.expiryMonth),
        expiryYear: Number(paymentForm.expiryYear),
      });

      if (booking?.id === paidBooking.id) {
        setBooking(paidBooking);
      }

      upsertBooking(paidBooking);
      setPaymentForm(emptyPaymentForm);
      setPayingBookingId(null);
      setMessage('Payment completed.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
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

  function renderPaymentForm(targetBooking: Booking) {
    return (
      <form className="payment-form" onSubmit={(event) => void submitBookingPayment(event, targetBooking)}>
        <input
          placeholder="Card number"
          value={paymentForm.cardNumber}
          onChange={(event) => setPaymentForm({ ...paymentForm, cardNumber: event.target.value })}
          required
        />
        <input
          placeholder="Card holder"
          value={paymentForm.cardHolderName}
          onChange={(event) => setPaymentForm({ ...paymentForm, cardHolderName: event.target.value })}
          required
        />
        <input
          min="1"
          max="12"
          placeholder="Month"
          type="number"
          value={paymentForm.expiryMonth}
          onChange={(event) => setPaymentForm({ ...paymentForm, expiryMonth: event.target.value })}
          required
        />
        <input
          min="2026"
          placeholder="Year"
          type="number"
          value={paymentForm.expiryYear}
          onChange={(event) => setPaymentForm({ ...paymentForm, expiryYear: event.target.value })}
          required
        />
        <input
          placeholder="CVV"
          value={paymentForm.cvv}
          onChange={(event) => setPaymentForm({ ...paymentForm, cvv: event.target.value })}
          required
        />
        <label className="checkbox">
          <input
            checked={paymentForm.saveCard}
            type="checkbox"
            onChange={(event) => setPaymentForm({ ...paymentForm, saveCard: event.target.checked })}
          />
          Save card last 4 digits
        </label>
        <button className="primary" disabled={submitting} type="submit">
          Pay now
        </button>
        <button disabled={submitting} onClick={() => void cancelBooking(targetBooking)} type="button">
          Cancel booking
        </button>
      </form>
    );
  }

  return (
    <main className="app">
      <header className="site-header">
        <button className="brand" onClick={() => navigateTo('home')} type="button">
          TravelHub
        </button>

        {page !== 'home' && (
          <button className="back-home" onClick={() => navigateTo('home')} type="button">
            Back
          </button>
        )}

        <nav className="site-nav">
          <button className={page === 'taxi' ? 'active' : ''} onClick={() => navigateTo('taxi')} type="button">
            Taxi
          </button>
          <button className={page === 'hotels' ? 'active' : ''} onClick={() => navigateTo('hotels')} type="button">
            Hotels
          </button>
          <button className={page === 'places' ? 'active' : ''} onClick={() => navigateTo('places')} type="button">
            Places
          </button>
          {currentUser?.role === 'SuperAdmin' && (
            <button className={page === 'admin' ? 'active' : ''} onClick={() => navigateTo('admin')} type="button">
              Admin
            </button>
          )}
        </nav>

        <div className="header-actions">
          {currentUser && <span>{currentUser.name}</span>}
          {currentUser ? (
            <>
              <button onClick={() => navigateTo('profile')} type="button">
                Profile
              </button>
              <button disabled={submitting} onClick={() => void logout()} type="button">
                Log out
              </button>
            </>
          ) : (
            <button onClick={openAuth} type="button">
              Register
            </button>
          )}
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      {page === 'home' && (
        <>
          <section className="hero">
            <p className="eyebrow">TravelHub</p>
            <h1>Plan your trip in a few clicks.</h1>
            <p>Taxi, hotels, and interesting places are gathered in one simple draft interface.</p>
          </section>

          <section className="home-steps" aria-label="TravelHub services">
            <button className="feature-card" onClick={() => navigateTo('taxi')} type="button">
              <span className="feature-icon">T</span>
              <strong>Taxi booking</strong>
              <small>Choose a taxi service and view contacts for your trip.</small>
            </button>

            <button className="feature-card" onClick={() => navigateTo('hotels')} type="button">
              <span className="feature-icon">H</span>
              <strong>Hotel booking</strong>
              <small>Open hotels, choose a room, and create a booking.</small>
            </button>

            <button className="feature-card" onClick={() => navigateTo('places')} type="button">
              <span className="feature-icon">P</span>
              <strong>Interesting places</strong>
              <small>View cities and places worth adding to your route.</small>
            </button>
          </section>
        </>
      )}

      {page === 'taxi' && (
        <>
          {canManageTaxi && !showTaxiForm && (
            <button
              className="primary create-service-button"
              onClick={() => {
                setTaxiForm(emptyTaxiForm);
                setEditingTaxiId(null);
                setShowTaxiForm(true);
              }}
              type="button"
            >
              Create new service +
            </button>
          )}

          <section className="page-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Taxi</p>
              <h2>Taxi booking</h2>
            </div>
            <span>{taxiServices.length} services</span>
          </div>

          {canManageTaxi && showTaxiForm && (
            <form className="form-grid" onSubmit={(event) => void submitTaxiService(event)}>
              <h3>{editingTaxiId ? 'Edit taxi service' : 'New taxi service'}</h3>
              <input
                placeholder="Company name"
                value={taxiForm.companyName}
                onChange={(event) => setTaxiForm({ ...taxiForm, companyName: event.target.value })}
                required
              />
              <div className="taxi-cities">
                <strong>Cities</strong>
                {taxiForm.cities.map((city, index) => (
                  <div className="taxi-city-row" key={index}>
                    <input
                      placeholder="City"
                      value={city}
                      onChange={(event) => updateTaxiCity(index, event.target.value)}
                      required
                    />
                    <button disabled={taxiForm.cities.length === 1} onClick={() => removeTaxiCity(index)} type="button">
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="link-button"
                  onClick={() => setTaxiForm({ ...taxiForm, cities: [...taxiForm.cities, ''] })}
                  type="button"
                >
                  Add city
                </button>
              </div>
              <input
                inputMode="tel"
                pattern={phoneNumberPattern}
                placeholder="Phone number"
                title="Use digits, spaces, +, -, or parentheses."
                type="tel"
                value={taxiForm.phoneNumber}
                onChange={(event) => setTaxiForm({ ...taxiForm, phoneNumber: event.target.value })}
                required
              />
              <div className="taxi-classes">
                <strong>Car classes</strong>
                {taxiForm.carClasses.map((carClass, index) => (
                  <div className="taxi-class-row" key={index}>
                    <select
                      value={carClass.name}
                      onChange={(event) => updateTaxiCarClass(index, { name: event.target.value })}
                      required
                    >
                      {taxiCarClassOptions.map((option) => (
                        <option
                          disabled={taxiForm.carClasses.some(
                            (currentCarClass, currentIndex) => currentIndex !== index && currentCarClass.name === option.value,
                          )}
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="taxi-price-input"
                      inputMode="decimal"
                      min="0.01"
                      pattern={pricePattern}
                      placeholder="Price per km"
                      step="0.01"
                      title="Use a number greater than 0, for example 1.50."
                      type="text"
                      value={carClass.pricePerKm}
                      onChange={(event) => updateTaxiCarClass(index, { pricePerKm: event.target.value })}
                      required
                    />
                    <button disabled={taxiForm.carClasses.length === 1} onClick={() => removeTaxiCarClass(index)} type="button">
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="link-button"
                  disabled={taxiForm.carClasses.length === taxiCarClassOptions.length}
                  onClick={addTaxiCarClass}
                  type="button"
                >
                  Add class
                </button>
              </div>
              <input
                placeholder="Description"
                value={taxiForm.description}
                onChange={(event) => setTaxiForm({ ...taxiForm, description: event.target.value })}
                required
              />
              <input
                placeholder="Image URL"
                pattern="https?://.+"
                title="Use a full http or https URL."
                type="url"
                value={taxiForm.imageUrl || ''}
                onChange={(event) => setTaxiForm({ ...taxiForm, imageUrl: event.target.value })}
                required
              />
              <button className="primary" disabled={submitting} type="submit">
                {editingTaxiId ? 'Save taxi service' : 'Create taxi service'}
              </button>
              <button
                className="link-button"
                disabled={submitting}
                onClick={() => {
                  setTaxiForm(emptyTaxiForm);
                  setEditingTaxiId(null);
                  setShowTaxiForm(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </form>
          )}

          <div className="card-grid taxi-grid">
            {taxiServices.map((taxi) => (
              <article className="service-card" key={taxi.id}>
                <img src={taxi.imageUrl || fallbackImage(taxi.companyName, 'taxi')} alt="" />
                <strong>{taxi.companyName}</strong>
                <span>{taxi.city}</span>
                <small>{taxi.phoneNumber}</small>
                <div className="tariff-list">
                  {taxi.carClasses.map((carClass) => (
                    <small key={carClass.id}>
                      {formatTaxiCarClassName(carClass.name)}: {formatMoney(carClass.pricePerKm)}/km
                    </small>
                  ))}
                </div>
                {canManageTaxi && (
                  <div className="taxi-card-actions">
                    <button disabled={submitting} onClick={() => editTaxiService(taxi)} type="button">
                      Update
                    </button>
                    <button disabled={submitting} onClick={() => void deleteTaxiService(taxi.id)} type="button">
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}

            {!loading && taxiServices.length === 0 && <p className="empty">No taxi services yet.</p>}
          </div>
          </section>
        </>
      )}

      {page === 'hotels' && (
        <section className="hotel-page">
          <aside className="panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Hotels</p>
                <h2>Hotel booking</h2>
              </div>
              <span>{loading ? 'Loading' : `${visibleHotels.length} available`}</span>
            </div>

            <label className="filter">
              City
              <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <div className="hotel-list">
              {visibleHotels.map((hotel) => (
                <article
                  className={`hotel-card ${selectedHotel?.id === hotel.id ? 'active' : ''}`}
                  key={hotel.id}
                >
                  <button className="hotel-card-main" onClick={() => void selectHotel(hotel)} type="button">
                    <img src={hotel.imageUrl || fallbackImage(hotel.name, 'hotel')} alt="" />
                    <span>
                      <strong>{hotel.name}</strong>
                      <small>
                        {hotel.city} / from {formatMoney(hotel.pricePerNight)}
                      </small>
                    </span>
                  </button>
                  {canManageHotels && (
                    <button
                      className="hotel-delete-button"
                      disabled={submitting}
                      onClick={() => setDeleteTarget({ kind: 'hotel', id: hotel.id, name: hotel.name })}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </article>
              ))}

              {!loading && visibleHotels.length === 0 && <p className="empty">No hotels yet.</p>}
            </div>
          </aside>

          <section className="panel wide">
            <div className="section-title">
              <h2>{selectedHotel ? selectedHotel.name : 'Select a hotel'}</h2>
              {selectedHotel && <span>{selectedHotel.city}</span>}
            </div>

            {selectedHotel ? (
              <>
                <img
                  className="selected-hotel-image"
                  src={selectedHotel.imageUrl || fallbackImage(selectedHotel.name, 'hotel')}
                  alt=""
                />
                <p className="description">{selectedHotel.description || selectedHotel.address}</p>

                {canManageHotels && (
                  <>
                    {!showRoomForm && (
                      <button className="small-primary-button" onClick={() => setShowRoomForm(true)} type="button">
                        Create room
                      </button>
                    )}

                    {showRoomForm && (
                      <form className="form-grid" onSubmit={(event) => void submitHotelRoom(event)}>
                        <h3>Create room</h3>
                        <label className="field-label">
                          Room type
                          <input
                            placeholder="Standard room"
                            value={roomForm.roomType}
                            onChange={(event) => setRoomForm({ ...roomForm, roomType: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field-label">
                          Capacity
                          <input
                            min="1"
                            placeholder="Guests count"
                            type="number"
                            value={roomForm.capacity}
                            onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field-label">
                          Total rooms
                          <input
                            min="1"
                            placeholder="How many rooms"
                            type="number"
                            value={roomForm.totalRooms}
                            onChange={(event) => setRoomForm({ ...roomForm, totalRooms: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field-label">
                          Price per night
                          <input
                            min="0"
                            placeholder="Price"
                            step="0.01"
                            type="number"
                            value={roomForm.pricePerNight}
                            onChange={(event) => setRoomForm({ ...roomForm, pricePerNight: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field-label">
                          Description
                          <input
                            placeholder="Room description"
                            value={roomForm.description}
                            onChange={(event) => setRoomForm({ ...roomForm, description: event.target.value })}
                            required
                          />
                        </label>
                        <label className="field-label">
                          Image URL
                          <input
                            placeholder="Image URL"
                            type="url"
                            value={roomForm.imageUrl || ''}
                            onChange={(event) => setRoomForm({ ...roomForm, imageUrl: event.target.value })}
                          />
                        </label>
                        <label className="checkbox">
                          <input
                            checked={roomForm.isAvailable}
                            type="checkbox"
                            onChange={(event) => setRoomForm({ ...roomForm, isAvailable: event.target.checked })}
                          />
                          Available for booking
                        </label>
                        <button className="primary" disabled={submitting} type="submit">
                          Create room
                        </button>
                        <button
                          className="link-button"
                          onClick={() => {
                            setShowRoomForm(false);
                            setRoomForm(emptyRoomForm);
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </>
                )}

                <div className="rooms">
                  {rooms.map((room) => (
                    <article
                      className={`room-card ${selectedRoom?.id === room.id ? 'active' : ''}`}
                      key={room.id}
                    >
                      <button
                        className="room-card-main"
                        disabled={!room.isAvailable}
                        onClick={() => setSelectedRoom(room)}
                        type="button"
                      >
                        <img src={room.imageUrl || fallbackImage(room.roomType, 'room')} alt="" />
                        <span>
                          <strong>{room.roomType}</strong>
                          <small>
                            {room.capacity} guests / {room.totalRooms} rooms / {formatMoney(room.pricePerNight)}
                          </small>
                        </span>
                      </button>
                      {canManageHotels && (
                        <button
                          className="room-delete-button"
                          disabled={submitting}
                          onClick={() => setDeleteTarget({ kind: 'room', id: room.id, name: room.roomType })}
                          type="button"
                        >
                          Delete
                        </button>
                      )}
                    </article>
                  ))}
                </div>

                {rooms.length === 0 && <p className="empty">No rooms for this hotel yet.</p>}

                {selectedRoom && !booking && (
                  <form className="form-grid" onSubmit={(event) => void submitBooking(event)}>
                    <h3>{selectedRoom.roomType} booking</h3>
                    <div className="booking-mode">
                      <button
                        className={bookingGuestMode === 'self' ? 'active' : ''}
                        onClick={() => selectBookingGuestMode('self')}
                        type="button"
                      >
                        Book for myself
                      </button>
                      <button
                        className={bookingGuestMode === 'other' ? 'active' : ''}
                        onClick={() => selectBookingGuestMode('other')}
                        type="button"
                      >
                        Book for someone else
                      </button>
                    </div>
                    <input
                      placeholder="Customer name"
                      value={bookingForm.customerName}
                      onChange={(event) => setBookingForm({ ...bookingForm, customerName: event.target.value })}
                      required
                    />
                    <input
                      pattern={phoneNumberPattern}
                      placeholder="Phone number"
                      type="tel"
                      value={bookingForm.phoneNumber}
                      onChange={(event) => setBookingForm({ ...bookingForm, phoneNumber: event.target.value })}
                      required
                    />
                    <input
                      placeholder="Email"
                      type="email"
                      value={bookingForm.email}
                      onChange={(event) => setBookingForm({ ...bookingForm, email: event.target.value })}
                      required
                    />
                    <input
                      type="date"
                      value={bookingForm.checkInDate}
                      onChange={(event) => setBookingForm({ ...bookingForm, checkInDate: event.target.value })}
                      required
                    />
                    <input
                      type="date"
                      value={bookingForm.checkOutDate}
                      onChange={(event) => setBookingForm({ ...bookingForm, checkOutDate: event.target.value })}
                      required
                    />
                    <input
                      min="1"
                      placeholder="Guests"
                      type="number"
                      value={bookingForm.guestsCount}
                      onChange={(event) => setBookingForm({ ...bookingForm, guestsCount: event.target.value })}
                      required
                    />
                    <button className="primary" disabled={submitting} type="submit">
                      Create booking
                    </button>
                  </form>
                )}

                {booking && (
                  <div className="booking-box">
                    <div>
                      <p className="eyebrow">Booking #{booking.id}</p>
                      <h3>{booking.status}</h3>
                      <p>{formatMoney(booking.totalPrice)} total</p>
                      {booking.savedCardLast4 && <p>Saved card: **** {booking.savedCardLast4}</p>}
                    </div>

                    {booking.status === 'PendingPayment' && (
                      renderPaymentForm(booking)
                    )}

                    {booking.status !== 'PendingPayment' && (
                      <button className="primary" onClick={resetFlow} type="button">
                        New booking
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="empty">Choose a hotel to see rooms and booking options.</p>
            )}
          </section>
        </section>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" aria-modal="true" role="dialog">
            <p className="eyebrow">Confirm action</p>
            <h3>Delete {deleteTarget.kind}?</h3>
            <p>{deleteTarget.name} will be removed from the list.</p>
            <div className="confirm-actions">
              <button className="link-button" disabled={submitting} onClick={() => setDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" disabled={submitting} onClick={() => void deleteSelectedItem()} type="button">
                Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {page === 'places' && (
        <section className="page-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Places</p>
              <h2>Interesting places</h2>
            </div>
            <span>{places.length} places</span>
          </div>

          <div className="card-grid">
            {places.map((place) => (
              <article className="service-card" key={place.id}>
                <img src={place.imageUrl || fallbackImage(place.name, 'azerbaijan landmark')} alt="" />
                <strong>{place.name}</strong>
                <span>{place.city}</span>
                <small>{place.description}</small>
              </article>
            ))}

            {!loading && places.length === 0 && <p className="empty">No places yet.</p>}
          </div>
        </section>
      )}

      {page === 'auth' && (
        <section className="auth-page">
          <div className="auth-panel">
            <p className="eyebrow">Account</p>
            <h2>{authMode === 'register' ? 'Register' : 'Login'}</h2>

            <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
              {authMode === 'register' && (
                <>
                  <input
                    placeholder="Name"
                    value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                    required
                  />
                  <div className="phone-field">
                    <span>{accountPhonePrefix}</span>
                    <input
                      pattern={accountPhonePattern}
                      placeholder="Phone number"
                      type="tel"
                      value={authForm.phoneNumber}
                      onChange={(event) => setAuthForm({ ...authForm, phoneNumber: event.target.value })}
                      required
                    />
                  </div>
                </>
              )}
              <input
                placeholder="Email"
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                required
              />
              <input
                minLength={6}
                placeholder="Password"
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                required
              />
              <button className="primary" disabled={submitting} type="submit">
                {authMode === 'register' ? 'Register' : 'Login'}
              </button>
              <button
                className="link-button"
                type="button"
                onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
              >
                {authMode === 'register' ? 'Use existing account' : 'Create account'}
              </button>
            </form>
          </div>
        </section>
      )}

      {page === 'profile' && currentUser && (
        <section className="page-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Profile</p>
              <h2>Profile</h2>
            </div>
            <span>{bookings.length} bookings</span>
          </div>

          <div className="profile-layout">
            <div className="auth-panel">
              {editingProfile ? (
                <form className="auth-form" onSubmit={(event) => void submitProfile(event)}>
                  <input
                    placeholder="Name"
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                    required
                  />
                  <div className="phone-field">
                    <span>{accountPhonePrefix}</span>
                    <input
                      pattern={accountPhonePattern}
                      placeholder="Phone number"
                      type="tel"
                      value={profileForm.phoneNumber}
                      onChange={(event) => setProfileForm({ ...profileForm, phoneNumber: event.target.value })}
                      required
                    />
                  </div>
                  <button className="primary" disabled={submitting} type="submit">
                    Save profile
                  </button>
                  <button className="link-button" onClick={() => setEditingProfile(false)} type="button">
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="profile-info">
                  <span>
                    <strong>Name</strong>
                    {currentUser.name}
                  </span>
                  <span>
                    <strong>Email</strong>
                    {currentUser.email}
                  </span>
                  <span>
                    <strong>Phone</strong>
                    {currentUser.phoneNumber || 'Not set'}
                  </span>
                  <span>
                    <strong>Role</strong>
                    {currentUser.role}
                  </span>
                  <button className="primary" disabled={submitting} onClick={openProfileEditor} type="button">
                    Edit profile
                  </button>
                  {currentUser.role !== 'SuperAdmin' && (
                    <button className="danger-button" disabled={submitting} onClick={() => void deleteProfile()} type="button">
                      Delete profile
                    </button>
                  )}
                </div>
              )}
            </div>

            <section className="panel profile-bookings">
              <div className="section-title">
                <h3>Booking history</h3>
                {bookingsLoading && <span>Loading</span>}
              </div>

              <div className="booking-history">
                {bookings.map((profileBooking) => (
                  <article className="history-card" key={profileBooking.id}>
                    <div>
                      <p className="eyebrow">Booking #{profileBooking.id}</p>
                      <h3>{profileBooking.hotelName}</h3>
                      <p>
                        {profileBooking.roomType} / {profileBooking.checkInDate} - {profileBooking.checkOutDate}
                      </p>
                      <small>
                        Guest: {profileBooking.customerName} / {profileBooking.guestsCount} guests /{' '}
                        {formatMoney(profileBooking.totalPrice)}
                      </small>
                      {profileBooking.savedCardLast4 && <small>Saved card: **** {profileBooking.savedCardLast4}</small>}
                    </div>

                    <div className="history-actions">
                      <span className={`status-pill ${profileBooking.status.toLowerCase()}`}>
                        {profileBooking.status}
                      </span>
                      {profileBooking.status === 'PendingPayment' && payingBookingId !== profileBooking.id && (
                        <>
                          <button
                            className="primary"
                            disabled={submitting}
                            onClick={() => {
                              setPayingBookingId(profileBooking.id);
                              setPaymentForm(emptyPaymentForm);
                            }}
                            type="button"
                          >
                            Pay
                          </button>
                          <button disabled={submitting} onClick={() => void cancelBooking(profileBooking)} type="button">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>

                    {profileBooking.status === 'PendingPayment' && payingBookingId === profileBooking.id && (
                      renderPaymentForm(profileBooking)
                    )}
                  </article>
                ))}

                {!bookingsLoading && bookings.length === 0 && <p className="empty">No bookings yet.</p>}
              </div>
            </section>
          </div>
        </section>
      )}

      {page === 'admin' && currentUser?.role === 'SuperAdmin' && (
        <section className="page-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Super Admin</p>
              <h2>User management</h2>
            </div>
            <span>{admins.length} admins / {adminCandidates.length} users</span>
          </div>

          <h3>Admins</h3>
          <div className="user-list">
            {admins.map((user) => (
              <article className="user-row" key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email}{user.isBlocked ? ' / blocked' : ''}</small>
                </span>
                <div className="user-actions">
                  {user.isBlocked ? (
                    <>
                      <button disabled={submitting} onClick={() => void demoteAdmin(user.id)} type="button">
                        Demote to user
                      </button>
                      <button disabled={submitting} onClick={() => void unblockUser(user.id)} type="button">
                        Unban
                      </button>
                      <button disabled={submitting} onClick={() => void deleteAccount(user.id)} type="button">
                        Delete account
                      </button>
                    </>
                  ) : (
                    <>
                      <button disabled={submitting} onClick={() => void demoteAdmin(user.id)} type="button">
                        Demote to user
                      </button>
                      <button disabled={submitting} onClick={() => void blockUser(user.id)} type="button">
                        Ban
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}

            {admins.length === 0 && <p className="empty">No admins yet.</p>}
          </div>

          <h3>Regular users</h3>
          <div className="user-list">
            {adminCandidates.map((user) => (
              <article className="user-row" key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email}{user.isBlocked ? ' / blocked' : ''}</small>
                </span>
                <div className="user-actions">
                  {user.isBlocked ? (
                    <>
                      <button disabled={submitting} onClick={() => void promoteToAdmin(user.id)} type="button">
                        Make admin
                      </button>
                      <button disabled={submitting} onClick={() => void unblockUser(user.id)} type="button">
                        Unban
                      </button>
                      <button disabled={submitting} onClick={() => void deleteAccount(user.id)} type="button">
                        Delete account
                      </button>
                    </>
                  ) : (
                    <>
                      <button disabled={submitting} onClick={() => void promoteToAdmin(user.id)} type="button">
                        Make admin
                      </button>
                      <button disabled={submitting} onClick={() => void blockUser(user.id)} type="button">
                        Ban
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}

            {adminCandidates.length === 0 && <p className="empty">No regular users yet.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTaxiCarClassName(name: string) {
  return taxiCarClassOptions.find((option) => option.value === name)?.label ?? name;
}

function splitTaxiCities(city: string) {
  const cities = city
    .split(',')
    .map((currentCity) => currentCity.trim())
    .filter(Boolean);

  return cities.length === 0 ? [''] : cities;
}

function toAzerbaijanPhoneNumber(phoneNumber: string) {
  return `${accountPhonePrefix} ${stripAzerbaijanPhonePrefix(phoneNumber)}`.trim();
}

function stripAzerbaijanPhonePrefix(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  return trimmed.startsWith(accountPhonePrefix) ? trimmed.slice(accountPhonePrefix.length).trim() : trimmed;
}

function isPage(value: unknown): value is Page {
  return typeof value === 'string' && appPages.includes(value as Page);
}

function fallbackImage(seed: string, topic = 'travel') {
  return `https://source.unsplash.com/640x420/?${encodeURIComponent(topic)}&sig=${encodeURIComponent(seed)}`;
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
