import { FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import ConfirmDeleteModal from './components/common/ConfirmDeleteModal';
import PaymentFormComponent from './components/booking/PaymentForm';
import { useHotelsFeature } from './features/hotels/hooks/useHotelsFeature';
import { useTaxiFeature } from './features/taxi/hooks/useTaxiFeature';
import SiteHeader from './components/common/SiteHeader';
import AdminPage from './pages/Admin/AdminPage';
import AuthPage from './pages/Auth/AuthPage';
import HomePage from './pages/Home/HomePage';
import HotelsPage from './pages/Hotels/HotelsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import TaxiPage from './pages/Taxi/TaxiPage';
import { formatTaxiCarClassName } from './utils/formatting';
import { getErrorMessage } from './utils/errors';
import type {
  AuthForm,
  AuthMode,
  AuthUser,
  Booking,
  BookingPayment,
  Page,
  PaymentCardForm,
  PaymentCardCreate,
  PaymentForm,
  PaymentMode,
  ProfileForm,
  SavedPaymentCard,
  TaxiBooking,
} from './types';

const appPages: Page[] = ['home', 'taxi', 'hotels', 'auth', 'admin', 'profile'];
const pageRoutes: Record<Page, string> = {
  home: '/',
  taxi: '/taxi',
  hotels: '/hotels',
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

function App() {
  const [page, setPage] = useState<Page>(() => getPageFromPathname(window.location.pathname));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AuthUser[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [taxiBookings, setTaxiBookings] = useState<TaxiBooking[]>([]);
  const [savedPaymentCards, setSavedPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('new');
  const [paymentCardForm, setPaymentCardForm] = useState<PaymentCardForm>(emptyPaymentCardForm);
  const [showPaymentCardForm, setShowPaymentCardForm] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState<number | null>(null);
  const [payingTaxiBookingId, setPayingTaxiBookingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [taxiBookingsLoading, setTaxiBookingsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [message, setMessage] = useState('');

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
    async function loadInitialData() {
      try {
        const restoredSession = await api.refresh();

        if (restoredSession) {
          setCurrentUser(restoredSession.user);
        }
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
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
      setTaxiBookings([]);
      setSavedPaymentCards([]);
      setPayingTaxiBookingId(null);
      return;
    }

    void loadBookings();
    void loadTaxiBookings();
    void loadPaymentCards();
  }, [currentUser?.id]);

  const initialDataLoading = loading || taxiFeature.model.loading || hotelsFeature.model.loading;

  function navigateTo(nextPage: Page) {
    setPage(nextPage);
    const nextPath = pageRoutes[nextPage];

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ page: nextPage }, '', nextPath);
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

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const authResponse =
        authMode === 'register'
          ? await api.register({ ...authForm, phoneNumber: toAzerbaijanPhoneNumber(authForm.phoneNumber) })
          : await api.login({ email: authForm.email, password: authForm.password });

      setCurrentUser(authResponse.user);
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
      hotelsFeature.actions.booking.setBooking(null);
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
      hotelsFeature.actions.booking.setBooking(null);
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

  function requireAuth(message: string) {
    setAuthMode('login');
    navigateTo('auth');
    setMessage(message);
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

      {page === 'home' && <HomePage onNavigate={navigateTo} />}

      {page === 'taxi' && (
        <TaxiPage
          currentUser={currentUser}
          feature={taxiFeature}
          loading={initialDataLoading}
          onOpenAuth={openAuth}
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
          loading={initialDataLoading}
          onOpenAuth={openAuth}
          phoneNumberPattern={phoneNumberPattern}
          renderPaymentForm={renderPaymentForm}
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

export default App;
