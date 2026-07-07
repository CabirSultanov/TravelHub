import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Booking, BookingCreate, BookingPayment, Hotel, HotelRoom, TaxiService } from './types';

type BookingForm = Omit<BookingCreate, 'hotelRoomId' | 'guestsCount'> & {
  guestsCount: string;
};

type PaymentForm = Omit<BookingPayment, 'expiryMonth' | 'expiryYear'> & {
  expiryMonth: string;
  expiryYear: string;
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

function App() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [taxiServices, setTaxiServices] = useState<TaxiService[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [hotelData, taxiData] = await Promise.all([api.getHotels(), api.getTaxiServices()]);
        setHotels(hotelData);
        setTaxiServices(taxiData);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
  }, []);

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

  function resetFlow() {
    setSelectedRoom(null);
    setBooking(null);
    setBookingForm(emptyBookingForm);
    setPaymentForm(emptyPaymentForm);
    setMessage('');
  }

  return (
    <main className="app">
      <section className="topbar">
        <div>
          <p className="eyebrow">TravelHub Client</p>
          <h1>Book stays and finish payment in one simple flow.</h1>
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
      </section>

      {message && <div className="notice">{message}</div>}

      <section className="layout">
        <div className="panel">
          <div className="section-title">
            <h2>Hotels</h2>
            <span>{loading ? 'Loading' : `${visibleHotels.length} available`}</span>
          </div>

          <div className="hotel-list">
            {visibleHotels.map((hotel) => (
              <button
                className={`hotel-card ${selectedHotel?.id === hotel.id ? 'active' : ''}`}
                key={hotel.id}
                onClick={() => void selectHotel(hotel)}
                type="button"
              >
                <img src={hotel.imageUrl || fallbackImage(hotel.name)} alt="" />
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
        </div>

        <div className="panel wide">
          <div className="section-title">
            <h2>{selectedHotel ? selectedHotel.name : 'Select a hotel'}</h2>
            {selectedHotel && <span>{selectedHotel.city}</span>}
          </div>

          {selectedHotel ? (
            <>
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
                    <img src={room.imageUrl || fallbackImage(room.roomType)} alt="" />
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
        </div>

        <div className="panel">
          <div className="section-title">
            <h2>Taxi</h2>
            <span>{taxiServices.length} services</span>
          </div>

          <div className="taxi-list">
            {taxiServices.map((taxi) => (
              <article className="taxi-card" key={taxi.id}>
                <strong>{taxi.companyName}</strong>
                <span>{taxi.city}</span>
                <small>
                  {taxi.phoneNumber} / {formatMoney(taxi.pricePerKm)}/km
                </small>
              </article>
            ))}

            {taxiServices.length === 0 && <p className="empty">No taxi services yet.</p>}
          </div>
        </div>
      </section>
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

function fallbackImage(seed: string) {
  return `https://source.unsplash.com/640x420/?hotel,travel&sig=${encodeURIComponent(seed)}`;
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
