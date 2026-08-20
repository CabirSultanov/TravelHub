import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import ConfirmDeleteModal from './components/common/ConfirmDeleteModal';
import PaymentFormComponent from './components/booking/PaymentForm';
import { useHotelsFeature } from './features/hotels/hooks/useHotelsFeature';
import { useTaxiFeature } from './features/taxi/hooks/useTaxiFeature';
import { useAdminUsers } from './hooks/useAdminUsers';
import { useAccount } from './hooks/useAccount';
import SiteHeader from './components/common/SiteHeader';
import AdminPage from './pages/Admin/AdminPage';
import AuthPage from './pages/Auth/AuthPage';
import HomePage from './pages/Home/HomePage';
import HotelsPage from './pages/Hotels/HotelsPage';
import MyTripsPage from './pages/MyTrips/MyTripsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import TaxiPage from './pages/Taxi/TaxiPage';
import { formatTaxiCarClassName } from './utils/formatting';
import { getErrorMessage } from './utils/errors';
import { accountPhonePrefix } from './utils/account';
import {
  buildAuthUrl,
  buildHotelDetailUrl,
  buildHotelsUrl,
  buildParsedRouteUrl,
  buildTaxiUrl,
  emptyHotelRouteSearch,
  emptyTaxiRouteSearch,
  getHotelIdFromPathname,
  normalizeHotelRouteSearch,
  normalizeTaxiRouteSearch,
  pageRoutes,
  parseAppRoute,
  type HotelRouteSearch,
  type ParsedRoute,
  type TaxiRouteSearch,
} from './utils/routing';
import type {
  AuthMode,
  Booking,
  BookingPayment,
  Hotel,
  Page,
  PaymentCardForm,
  PaymentCardCreate,
  PaymentForm,
  PaymentMode,
  SavedPaymentCard,
  TaxiBooking,
} from './types';

const phoneNumberPattern = String.raw`\+?[0-9\s()-]{7,30}`;
const accountPhonePattern = String.raw`[0-9\s()-]{9,30}`;
const pricePattern = String.raw`[0-9]+(\.[0-9]{1,2})?`;
const cardNumberPattern = String.raw`[0-9\s]{16,23}`;
const cvvPattern = String.raw`[0-9]{3,4}`;
const currentYear = new Date().getFullYear();

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

function App() {
  const initialRouteRef = useRef<ParsedRoute | null>(null);
  initialRouteRef.current ??= parseAppRoute(window.location.pathname, window.location.search);
  const initialRoute = initialRouteRef.current;
  const [page, setPage] = useState<Page>(initialRoute.page);
  const [hotelDetailId, setHotelDetailId] = useState<number | null>(initialRoute.hotelId);
  const [hotelSearch, setHotelSearch] = useState<HotelRouteSearch>(initialRoute.hotels);
  const [requestedHotelRoomId, setRequestedHotelRoomId] = useState<number | null>(initialRoute.hotels.roomId);
  const [requestedTaxiSearch, setRequestedTaxiSearch] = useState<TaxiRouteSearch>(initialRoute.taxi);
  const [hotelDetailLoading, setHotelDetailLoading] = useState(false);
  const [hotelDetailNotFound, setHotelDetailNotFound] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [taxiBookings, setTaxiBookings] = useState<TaxiBooking[]>([]);
  const [savedPaymentCards, setSavedPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('new');
  const [paymentCardForm, setPaymentCardForm] = useState<PaymentCardForm>(emptyPaymentCardForm);
  const [showPaymentCardForm, setShowPaymentCardForm] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState<number | null>(null);
  const [payingTaxiBookingId, setPayingTaxiBookingId] = useState<number | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [taxiBookingsLoading, setTaxiBookingsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [blockedHotelBackSignal, setBlockedHotelBackSignal] = useState(0);
  const hotelEditOpenRef = useRef(false);
  const currentPathRef = useRef(window.location.pathname);
  const hotelEditGuardPathRef = useRef<string | null>(null);
  const account = useAccount({
    initialAuthMode: initialRoute.authMode,
    setMessage,
    setSubmitting,
    onAuthenticated: () => navigateTo('home'),
    onSignedOut: resetAccountData,
  });
  const { currentUser, setCurrentUser, authMode, setAuthMode, authForm, setAuthForm, profileForm, setProfileForm, editingProfile, setEditingProfile, loading } = account;
  const adminUsers = useAdminUsers({
    active: page === 'admin' && currentUser?.role === 'SuperAdmin',
    setMessage,
    setSubmitting,
  });

  const taxiFeature = useTaxiFeature({
    currentUser,
    onBookingCreated: (booking) => {
      upsertTaxiBooking(booking);
      void loadTaxiBookings();
    },
    onRequireAuth: requireAuth,
    onResetPayment: resetPaymentForm,
    onResetTaxiPayment: () => setPayingTaxiBookingId(null),
    setMessage,
    setSubmitting,
  });
  const hotelsFeature = useHotelsFeature({
    currentUser,
    onBookingCreated: upsertBooking,
    onRequireAuth: requireAuth,
    onResetPayment: resetPaymentForm,
    onResetBookingFlow: () => {
      setPaymentForm(emptyPaymentForm);
      setPayingBookingId(null);
    },
    setMessage,
    setSubmitting,
  });
  const hotelEditIsOpen = hotelsFeature.model.showHotelForm || hotelsFeature.model.showRoomForm;

  useEffect(() => {
    hotelEditOpenRef.current = hotelEditIsOpen;
  }, [hotelEditIsOpen]);

  useEffect(() => {
    currentPathRef.current = `${window.location.pathname}${window.location.search}`;
  }, [authMode, hotelDetailId, hotelSearch, page, requestedTaxiSearch]);

  useEffect(() => {
    const currentPath = currentPathRef.current;

    if (!hotelEditIsOpen || !currentPath.startsWith('/hotels')) {
      hotelEditGuardPathRef.current = null;
      return;
    }

    if (hotelEditGuardPathRef.current === currentPath) {
      return;
    }

    hotelEditGuardPathRef.current = currentPath;
    window.history.pushState(
      { page: 'hotels', hotelId: getHotelIdFromPathname(currentPath), editGuard: true },
      '',
      currentPath,
    );
  }, [hotelEditIsOpen]);

  useEffect(() => {
    api.setSessionExpiredHandler(() => {
      setCurrentUser(null);
      hotelsFeature.actions.booking.setBooking(null);
      taxiFeature.actions.setBooking(null);
      setBookings([]);
      setTaxiBookings([]);
      setSavedPaymentCards([]);
      setPayingBookingId(null);
      setPayingTaxiBookingId(null);
    });

    return () => api.setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    const currentRoute = parseAppRoute(window.location.pathname, window.location.search);
    const canonicalUrl = buildParsedRouteUrl(currentRoute);

    applyParsedRoute(currentRoute);
    window.history.replaceState(
      { page: currentRoute.page, hotelId: currentRoute.hotelId },
      '',
      canonicalUrl,
    );
    currentPathRef.current = canonicalUrl;

    function handleBrowserBack() {
      if (hotelEditOpenRef.current && currentPathRef.current.startsWith('/hotels')) {
        const currentPath = currentPathRef.current;
        window.history.pushState(
          { page: 'hotels', hotelId: getHotelIdFromPathname(currentPath), editGuard: true },
          '',
          currentPath,
        );
        hotelEditGuardPathRef.current = currentPath;
        setBlockedHotelBackSignal((signal) => signal + 1);
        return;
      }

      const nextRoute = parseAppRoute(window.location.pathname, window.location.search);
      const canonicalUrl = buildParsedRouteUrl(nextRoute);
      applyParsedRoute(nextRoute);
      if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) {
        window.history.replaceState({ page: nextRoute.page, hotelId: nextRoute.hotelId }, '', canonicalUrl);
      }
      currentPathRef.current = canonicalUrl;
      setHotelDetailNotFound(false);
      window.scrollTo({ top: 0, left: 0 });
    }

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBookings([]);
      setTaxiBookings([]);
      setSavedPaymentCards([]);
      setPayingTaxiBookingId(null);
      return;
    }

    void loadBookings();
    void loadTaxiBookings();
    void loadPaymentCards();
  }, [currentUser?.id]);

  useEffect(() => {
    if (loading || currentUser || (page !== 'profile' && page !== 'trips')) {
      return;
    }

    requireAuth('Please sign in to view this page.');
  }, [currentUser, loading, page]);

  const initialDataLoading = loading || taxiFeature.model.loading || hotelsFeature.model.loading;

  useEffect(() => {
    if (page !== 'hotels' || hotelDetailId === null) {
      return;
    }

    setHotelDetailNotFound(false);

    if (hotelsFeature.model.selectedHotel?.id === hotelDetailId) {
      setHotelDetailLoading(false);
      return;
    }

    const existingHotel = hotelsFeature.model.hotels.find((hotel) => hotel.id === hotelDetailId);

    if (existingHotel) {
      setHotelDetailLoading(false);
      hotelsFeature.actions.hotelList.select(existingHotel);
      return;
    }

    if (hotelsFeature.model.loading) {
      return;
    }

    let ignore = false;
    setHotelDetailLoading(true);

    api
      .getHotel(hotelDetailId)
      .then((hotel) => {
        if (!ignore) {
          hotelsFeature.actions.hotelList.select(hotel);
        }
      })
      .catch(() => {
        if (!ignore) {
          setHotelDetailNotFound(true);
        }
      })
      .finally(() => {
        if (!ignore) {
          setHotelDetailLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [hotelDetailId, hotelsFeature.model.hotels, hotelsFeature.model.loading, hotelsFeature.model.selectedHotel?.id, page]);

  useEffect(() => {
    if (page !== 'hotels' || hotelDetailId === null || requestedHotelRoomId === null || hotelsFeature.model.roomsLoading) {
      return;
    }

    const requestedRoom = hotelsFeature.model.rooms.find((room) => room.id === requestedHotelRoomId);

    if (requestedRoom) {
      if (hotelsFeature.model.selectedRoom?.id !== requestedRoom.id) {
        hotelsFeature.actions.roomList.select(requestedRoom);
      }

      return;
    }

    if (hotelsFeature.model.rooms.length > 0) {
      const nextSearch = normalizeHotelRouteSearch({ ...hotelSearch, roomId: null });
      setHotelSearch(nextSearch);
      setRequestedHotelRoomId(null);
      replaceRoute(buildHotelDetailUrl(hotelDetailId, nextSearch), { page: 'hotels', hotelId: hotelDetailId });
    }
  }, [
    hotelDetailId,
    hotelSearch,
    hotelsFeature.model.rooms,
    hotelsFeature.model.roomsLoading,
    hotelsFeature.model.selectedRoom?.id,
    page,
    requestedHotelRoomId,
  ]);

  useEffect(() => {
    if (page !== 'taxi' || requestedTaxiSearch.serviceId === null || taxiFeature.model.loading) {
      return;
    }

    const requestedService = taxiFeature.model.taxiServices.find((taxiService) => taxiService.id === requestedTaxiSearch.serviceId);

    if (!requestedService) {
      setRequestedTaxiSearch(emptyTaxiRouteSearch);
      replaceRoute(pageRoutes.taxi, { page: 'taxi' });
      return;
    }

    if (
      requestedTaxiSearch.carClassName &&
      !requestedService.carClasses.some((carClass) => carClass.name === requestedTaxiSearch.carClassName)
    ) {
      const nextSearch = { serviceId: requestedService.id, carClassName: '' };
      setRequestedTaxiSearch(nextSearch);
      replaceRoute(buildTaxiUrl(nextSearch), { page: 'taxi' });
      taxiFeature.actions.service.select(requestedService);
      return;
    }

    if (
      taxiFeature.model.selectedTaxiService?.id !== requestedService.id ||
      (requestedTaxiSearch.carClassName && taxiFeature.model.selectedTaxiCarClass?.name !== requestedTaxiSearch.carClassName)
    ) {
      taxiFeature.actions.service.select(requestedService, requestedTaxiSearch.carClassName);
    }
  }, [
    page,
    requestedTaxiSearch,
    taxiFeature.model.loading,
    taxiFeature.model.selectedTaxiCarClass?.name,
    taxiFeature.model.selectedTaxiService?.id,
    taxiFeature.model.taxiServices,
  ]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(''), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function applyParsedRoute(route: ParsedRoute) {
    setPage(route.page);
    setHotelDetailId(route.hotelId);
    setHotelSearch(route.hotels);
    setRequestedHotelRoomId(route.hotels.roomId);
    setRequestedTaxiSearch(route.taxi);
    setAuthMode(route.authMode);
    setHotelDetailLoading(false);
    setHotelDetailNotFound(false);
    hotelsFeature.actions.hotelList.setSearch({
      city: route.hotels.city,
      checkInDate: route.hotels.checkIn,
      checkOutDate: route.hotels.checkOut,
    });
  }

  function pushRoute(url: string, state: Record<string, unknown>) {
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.pushState(state, '', url);
    }

    currentPathRef.current = url;
  }

  function replaceRoute(url: string, state: Record<string, unknown>) {
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(state, '', url);
    }

    currentPathRef.current = url;
  }

  function navigateTo(nextPage: Page) {
    setPage(nextPage);
    setHotelDetailId(null);
    setHotelDetailLoading(false);
    setHotelDetailNotFound(false);
    setRequestedHotelRoomId(null);
    window.scrollTo({ top: 0, left: 0 });
    let nextPath = nextPage === 'auth' ? buildAuthUrl(authMode) : pageRoutes[nextPage];

    if (nextPage === 'hotels') {
      setHotelSearch(emptyHotelRouteSearch);
      hotelsFeature.actions.hotelList.setSearch({ city: '' });
    }

    if (nextPage === 'taxi') {
      const currentTaxiSearch = taxiFeature.model.selectedTaxiService
        ? {
            serviceId: taxiFeature.model.selectedTaxiService.id,
            carClassName: taxiFeature.model.selectedTaxiCarClass?.name ?? '',
          }
        : emptyTaxiRouteSearch;

      setRequestedTaxiSearch(currentTaxiSearch);
      nextPath = buildTaxiUrl(currentTaxiSearch);
    }

    pushRoute(nextPath, { page: nextPage });
  }

  function searchHotels(search: Partial<HotelRouteSearch>) {
    const nextSearch = normalizeHotelRouteSearch(search);
    const nextPath = buildHotelsUrl(nextSearch);

    setPage('hotels');
    setHotelDetailId(null);
    setHotelDetailLoading(false);
    setHotelDetailNotFound(false);
    setHotelSearch(nextSearch);
    setRequestedHotelRoomId(null);
    hotelsFeature.actions.hotelList.setSearch({
      city: nextSearch.city,
      checkInDate: nextSearch.checkIn,
      checkOutDate: nextSearch.checkOut,
    });
    window.scrollTo({ top: 0, left: 0 });
    pushRoute(nextPath, { page: 'hotels', hotelId: null });
  }

  function searchHotelsFromHome(city: string, checkIn = '', checkOut = '') {
    searchHotels({ city, checkIn, checkOut });
  }

  function showDestinations() {
    navigateTo('home');
    window.requestAnimationFrame(() => {
      document.querySelector('[data-od-id="destinations-section"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openHotelDetail(hotel: Hotel) {
    const detailSearch = normalizeHotelRouteSearch({ ...hotelSearch, roomId: null });

    setPage('hotels');
    setHotelDetailId(hotel.id);
    setHotelDetailLoading(false);
    setHotelDetailNotFound(false);
    setHotelSearch(detailSearch);
    setRequestedHotelRoomId(null);
    hotelsFeature.actions.hotelList.select(hotel);
    window.scrollTo({ top: 0, left: 0 });

    const nextPath = buildHotelDetailUrl(hotel.id, detailSearch);

    pushRoute(nextPath, { page: 'hotels', hotelId: hotel.id });
  }

  function openHotelsList() {
    const nextSearch = normalizeHotelRouteSearch({ ...hotelSearch, roomId: null });
    const nextPath = buildHotelsUrl(nextSearch);

    setPage('hotels');
    setHotelDetailId(null);
    setHotelDetailLoading(false);
    setHotelDetailNotFound(false);
    setRequestedHotelRoomId(null);
    setHotelSearch(nextSearch);
    window.scrollTo({ top: 0, left: 0 });
    pushRoute(nextPath, { page: 'hotels', hotelId: null });
  }

  function selectHotelRoomFromPage(roomId: number) {
    if (hotelDetailId === null) {
      return;
    }

    const nextSearch = normalizeHotelRouteSearch({ ...hotelSearch, roomId });
    const nextPath = buildHotelDetailUrl(hotelDetailId, nextSearch);

    setHotelSearch(nextSearch);
    setRequestedHotelRoomId(roomId);
    pushRoute(nextPath, { page: 'hotels', hotelId: hotelDetailId });
  }

  function updateTaxiRouteSearch(search: Partial<TaxiRouteSearch>) {
    const nextSearch = normalizeTaxiRouteSearch(search);
    const nextPath = buildTaxiUrl(nextSearch);

    setPage('taxi');
    setRequestedTaxiSearch(nextSearch);
    pushRoute(nextPath, { page: 'taxi' });
  }

  function setAuthModeFromUrl(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setPage('auth');
    setHotelDetailId(null);
    pushRoute(buildAuthUrl(nextMode), { page: 'auth' });
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
    setPaymentSuccess(false);
    setMessage('');

    try {
      const payment = createPaymentPayload();
      await delay(3000);
      const paidBooking = await api.payBooking(targetBooking.id, payment);

      setPaymentProcessing(false);
      setPaymentSuccess(true);
      await delay(3000);

      if (hotelsFeature.model.booking?.id === paidBooking.id) {
        hotelsFeature.actions.booking.setBooking(paidBooking);
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
      setPaymentSuccess(false);
    }
  }

  async function submitTaxiBookingPayment(event: FormEvent<HTMLFormElement>, targetBooking: TaxiBooking) {
    event.preventDefault();

    setSubmitting(true);
    setPaymentProcessing(true);
    setPaymentSuccess(false);
    setMessage('');

    try {
      const payment = createPaymentPayload();
      await delay(3000);
      const paidBooking = await api.payTaxiBooking(targetBooking.id, payment);

      setPaymentProcessing(false);
      setPaymentSuccess(true);
      await delay(3000);

      if (taxiFeature.model.taxiBooking?.id === paidBooking.id) {
        taxiFeature.actions.setBooking(paidBooking);
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
      setPaymentSuccess(false);
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

      if (hotelsFeature.model.booking?.id === targetBooking.id) {
        hotelsFeature.actions.booking.setBooking(cancelledBooking);
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

      if (taxiFeature.model.taxiBooking?.id === targetBooking.id) {
        taxiFeature.actions.setBooking(cancelledBooking);
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

  function resetAccountData() {
    hotelsFeature.actions.booking.setBooking(null);
    setBookings([]);
    setTaxiBookings([]);
    setSavedPaymentCards([]);
    setPaymentCardForm(emptyPaymentCardForm);
    setShowPaymentCardForm(false);
    setPayingBookingId(null);
    setPayingTaxiBookingId(null);
    navigateTo('home');
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
    setAuthModeFromUrl('register');
    setMessage('');
  }

  function requireAuth(message: string) {
    setAuthModeFromUrl('login');
    setMessage(message);
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
        onLogout={account.logout}
        onNavigate={navigateTo}
        onOpenAuth={openAuth}
        page={page}
        submitting={submitting}
      />

      {message && page !== 'auth' && (
        <div className="app-toast" role="status" aria-live="polite">
          <span>{message}</span>
          <button aria-label="Close notification" onClick={() => setMessage('')} type="button">
            ×
          </button>
        </div>
      )}

      {(paymentProcessing || paymentSuccess) && (
        <div className="payment-processing-overlay" role="status" aria-live="polite">
          <div className={`payment-processing-panel${paymentSuccess ? ' payment-success-panel' : ''}`}>
            {paymentSuccess ? (
              <>
                <span className="payment-success-icon" aria-hidden="true">
                  ✓
                </span>
                <strong>Paid</strong>
              </>
            ) : (
              <>
                <span className="payment-processing-spinner" aria-hidden="true" />
                <strong>Processing payment...</strong>
              </>
            )}
          </div>
        </div>
      )}

      {page === 'home' && (
        <HomePage
          cities={hotelsFeature.model.cities}
          hotels={hotelsFeature.model.hotels}
          onHotelSearch={searchHotelsFromHome}
          onNavigate={navigateTo}
        />
      )}

      {page === 'taxi' && (
        <TaxiPage
          currentUser={currentUser}
          feature={taxiFeature}
          loading={initialDataLoading}
          onNavigate={navigateTo}
          onOpenAuth={openAuth}
          onShowDestinations={showDestinations}
          onTaxiRouteChange={updateTaxiRouteSearch}
          phoneNumberPattern={phoneNumberPattern}
          pricePattern={pricePattern}
          renderPaymentForm={renderPaymentForm}
          submitting={submitting}
        />
      )}

      {page === 'hotels' && (
        <HotelsPage
          currentUser={currentUser}
          feature={hotelsFeature}
          hotelDetailId={hotelDetailId}
          hotelDetailLoading={hotelDetailLoading}
          hotelDetailNotFound={hotelDetailNotFound}
          blockedBackSignal={blockedHotelBackSignal}
          loading={initialDataLoading}
          onBackToHotels={openHotelsList}
          onNavigate={navigateTo}
          onOpenAuth={openAuth}
          onOpenHotel={openHotelDetail}
          onRoomSelect={selectHotelRoomFromPage}
          onSearchHotels={searchHotels}
          onShowDestinations={showDestinations}
          phoneNumberPattern={phoneNumberPattern}
          requestedRoomId={requestedHotelRoomId}
          renderPaymentForm={renderPaymentForm}
          search={hotelSearch}
          submitting={submitting}
        />
      )}

      {hotelsFeature.model.deleteTarget && (
        <ConfirmDeleteModal
          onCancel={hotelsFeature.actions.delete.cancel}
          onConfirm={hotelsFeature.actions.delete.confirm}
          submitting={submitting}
          target={hotelsFeature.model.deleteTarget}
        />
      )}

      {page === 'auth' && (
        <AuthPage
          accountPhonePattern={accountPhonePattern}
          accountPhonePrefix={accountPhonePrefix}
          authForm={authForm}
          authMode={authMode}
          message={message}
          onAuthFormChange={setAuthForm}
          onSubmit={(event) => void account.submitAuth(event)}
          onToggleMode={() => setAuthModeFromUrl(authMode === 'register' ? 'login' : 'register')}
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
          onDeleteProfile={account.deleteProfile}
          onOpenPaymentForm={openPaymentForm}
          onOpenProfileEditor={account.openProfileEditor}
          onOpenTaxiPaymentForm={openTaxiPaymentForm}
          onPaymentCardFormChange={setPaymentCardForm}
          onProfileFormChange={setProfileForm}
          onShowPaymentCardForm={setShowPaymentCardForm}
          onSubmitPaymentCard={(event) => void submitPaymentCard(event)}
          onSubmitProfile={(event) => void account.submitProfile(event)}
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

      {page === 'trips' && currentUser && (
        <MyTripsPage
          bookings={bookings}
          bookingsLoading={bookingsLoading}
          formatTaxiCarClassName={formatTaxiCarClassName}
          onCancelBooking={cancelBooking}
          onCancelTaxiBooking={cancelTaxiBooking}
          onNavigate={navigateTo}
          onOpenPaymentForm={openPaymentForm}
          onOpenTaxiPaymentForm={openTaxiPaymentForm}
          payingBookingId={payingBookingId}
          payingTaxiBookingId={payingTaxiBookingId}
          renderPaymentForm={renderPaymentForm}
          submitting={submitting}
          taxiBookings={taxiBookings}
          taxiBookingsLoading={taxiBookingsLoading}
        />
      )}

      {page === 'admin' && currentUser?.role === 'SuperAdmin' && (
        <AdminPage
          adminCandidates={adminUsers.adminCandidates}
          admins={adminUsers.admins}
          onBlock={adminUsers.block}
          onDelete={adminUsers.remove}
          onDemote={adminUsers.demote}
          onPromote={adminUsers.promote}
          onUnblock={adminUsers.unblock}
          submitting={submitting}
        />
      )}
    </main>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default App;
