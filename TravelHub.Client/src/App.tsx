import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type {
  AuthUser,
  Booking,
  BookingCreate,
  BookingPayment,
  Hotel,
  HotelRoom,
  Place,
  TaxiService,
} from './types';

type Page = 'home' | 'taxi' | 'hotels' | 'places' | 'auth' | 'admin' | 'profile';
type AuthMode = 'login' | 'register';

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
  password: string;
};

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
  password: '',
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
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);
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
    if (page !== 'admin' || currentUser?.role !== 'SuperAdmin') {
      return;
    }

    void loadAdminLists();
  }, [currentUser?.role, page]);

  const cities = useMemo(() => {
    return Array.from(new Set(hotels.map((hotel) => hotel.city))).sort((a, b) => a.localeCompare(b));
  }, [hotels]);

  const visibleHotels = useMemo(() => {
    if (!cityFilter) {
      return hotels;
    }

    return hotels.filter((hotel) => hotel.city === cityFilter);
  }, [cityFilter, hotels]);

  async function selectHotel(hotel: Hotel) {
    setSelectedHotel(hotel);
    setSelectedRoom(null);
    setBooking(null);
    setMessage('');
    setRooms([]);

    try {
      setRooms(await api.getHotelRooms(hotel.id));
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setAuthMode('login');
      setPage('auth');
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
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!booking) {
      return;
    }

    setSubmitting(true);
    setMessage('Processing payment...');

    try {
      await delay(1800);
      const paidBooking = await api.payBooking(booking.id, {
        ...paymentForm,
        expiryMonth: Number(paymentForm.expiryMonth),
        expiryYear: Number(paymentForm.expiryYear),
      });

      setBooking(paidBooking);
      setPaymentForm(emptyPaymentForm);
      setMessage('Payment completed.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking() {
    if (!booking) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.cancelBooking(booking.id);
      setBooking({ ...booking, status: 'Cancelled', cancelledAt: new Date().toISOString() });
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
          ? await api.register(authForm)
          : await api.login({ email: authForm.email, password: authForm.password });

      setCurrentUser(user);
      setAuthForm(emptyAuthForm);
      setMessage(authMode === 'register' ? 'Registration completed.' : 'Logged in.');
      setPage('home');
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
      setPage('home');
      setMessage('Logged out.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openAuth() {
    setAuthMode('register');
    setPage('auth');
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

  function resetFlow() {
    setSelectedRoom(null);
    setBooking(null);
    setBookingForm(emptyBookingForm);
    setPaymentForm(emptyPaymentForm);
    setMessage('');
  }

  return (
    <main className="app">
      <header className="site-header">
        <button className="brand" onClick={() => setPage('home')} type="button">
          TravelHub
        </button>

        {page !== 'home' && (
          <button className="back-home" onClick={() => setPage('home')} type="button">
            Back
          </button>
        )}

        <nav className="site-nav">
          <button className={page === 'taxi' ? 'active' : ''} onClick={() => setPage('taxi')} type="button">
            Taxi
          </button>
          <button className={page === 'hotels' ? 'active' : ''} onClick={() => setPage('hotels')} type="button">
            Hotels
          </button>
          <button className={page === 'places' ? 'active' : ''} onClick={() => setPage('places')} type="button">
            Places
          </button>
          {currentUser?.role === 'SuperAdmin' && (
            <button className={page === 'admin' ? 'active' : ''} onClick={() => setPage('admin')} type="button">
              Admin
            </button>
          )}
        </nav>

        <div className="header-actions">
          {currentUser && <span>{currentUser.name}</span>}
          {currentUser ? (
            <>
              <button onClick={() => setPage('profile')} type="button">
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
            <button className="feature-card" onClick={() => setPage('taxi')} type="button">
              <span className="feature-icon">T</span>
              <strong>Taxi booking</strong>
              <small>Choose a taxi service and view contacts for your trip.</small>
            </button>

            <button className="feature-card" onClick={() => setPage('hotels')} type="button">
              <span className="feature-icon">H</span>
              <strong>Hotel booking</strong>
              <small>Open hotels, choose a room, and create a booking.</small>
            </button>

            <button className="feature-card" onClick={() => setPage('places')} type="button">
              <span className="feature-icon">P</span>
              <strong>Interesting places</strong>
              <small>View cities and places worth adding to your route.</small>
            </button>
          </section>
        </>
      )}

      {page === 'taxi' && (
        <section className="page-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Taxi</p>
              <h2>Taxi booking</h2>
            </div>
            <span>{taxiServices.length} services</span>
          </div>

          <div className="card-grid">
            {taxiServices.map((taxi) => (
              <article className="service-card" key={taxi.id}>
                <img src={taxi.imageUrl || fallbackImage(taxi.companyName, 'taxi')} alt="" />
                <strong>{taxi.companyName}</strong>
                <span>{taxi.city}</span>
                <small>
                  {taxi.phoneNumber} / {formatMoney(taxi.pricePerKm)}/km
                </small>
              </article>
            ))}

            {!loading && taxiServices.length === 0 && <p className="empty">No taxi services yet.</p>}
          </div>
        </section>
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
                <button
                  className={`hotel-card ${selectedHotel?.id === hotel.id ? 'active' : ''}`}
                  key={hotel.id}
                  onClick={() => void selectHotel(hotel)}
                  type="button"
                >
                  <img src={hotel.imageUrl || fallbackImage(hotel.name, 'hotel')} alt="" />
                  <span>
                    <strong>{hotel.name}</strong>
                    <small>
                      {hotel.city} / from {formatMoney(hotel.pricePerNight)}
                    </small>
                  </span>
                </button>
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

                <div className="rooms">
                  {rooms.map((room) => (
                    <button
                      className={`room-card ${selectedRoom?.id === room.id ? 'active' : ''}`}
                      disabled={!room.isAvailable}
                      key={room.id}
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
                  ))}
                </div>

                {rooms.length === 0 && <p className="empty">No rooms for this hotel yet.</p>}

                {selectedRoom && !booking && (
                  <form className="form-grid" onSubmit={(event) => void submitBooking(event)}>
                    <h3>{selectedRoom.roomType} booking</h3>
                    <input
                      placeholder="Customer name"
                      value={bookingForm.customerName}
                      onChange={(event) => setBookingForm({ ...bookingForm, customerName: event.target.value })}
                      required
                    />
                    <input
                      placeholder="Phone number"
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
                      <form className="payment-form" onSubmit={(event) => void submitPayment(event)}>
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
                        <button disabled={submitting} onClick={() => void cancelBooking()} type="button">
                          Cancel booking
                        </button>
                      </form>
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
                <input
                  placeholder="Name"
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  required
                />
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
        <section className="auth-page">
          <div className="auth-panel">
            <p className="eyebrow">Profile</p>
            <h2>Profile</h2>
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
                <strong>Role</strong>
                {currentUser.role}
              </span>
            </div>
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
                  <button disabled={submitting} onClick={() => void demoteAdmin(user.id)} type="button">
                    Demote
                  </button>
                  <button disabled={submitting || user.isBlocked} onClick={() => void blockUser(user.id)} type="button">
                    Block
                  </button>
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
                  <button disabled={submitting || user.isBlocked} onClick={() => void promoteToAdmin(user.id)} type="button">
                    Make admin
                  </button>
                  <button disabled={submitting || user.isBlocked} onClick={() => void blockUser(user.id)} type="button">
                    Block
                  </button>
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
