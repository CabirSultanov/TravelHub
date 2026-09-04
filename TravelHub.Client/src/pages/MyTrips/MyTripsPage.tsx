import type { ReactNode } from 'react';
import type { Booking, Page, TaxiBooking } from '../../types';
import { formatMoney } from '../../utils/formatting';

type MyTripsPageProps = {
  bookings: Booking[];
  taxiBookings: TaxiBooking[];
  bookingsLoading: boolean;
  taxiBookingsLoading: boolean;
  submitting: boolean;
  payingBookingId: number | null;
  formatTaxiCarClassName: (name: string) => string;
  renderPaymentForm: (booking: Booking) => ReactNode;
  onNavigate: (page: Page) => void;
  onOpenPaymentForm: (bookingId: number) => void;
  onCancelBooking: (booking: Booking) => void | Promise<void>;
  onCancelTaxiBooking: (booking: TaxiBooking) => void | Promise<void>;
};

export default function MyTripsPage({
  bookings,
  taxiBookings,
  bookingsLoading,
  taxiBookingsLoading,
  submitting,
  payingBookingId,
  formatTaxiCarClassName,
  renderPaymentForm,
  onNavigate,
  onOpenPaymentForm,
  onCancelBooking,
  onCancelTaxiBooking,
}: MyTripsPageProps) {
  const allCount = bookings.length + taxiBookings.length;
  const pendingCount =
    bookings.filter((booking) => booking.status === 'PendingPayment').length +
    taxiBookings.filter((booking) => booking.status === 'AwaitingDriver').length;
  const paidCount =
    bookings.filter((booking) => booking.status === 'Paid').length +
    taxiBookings.filter((booking) => ['Paid', 'DriverAssigned', 'DriverArrived', 'Completed'].includes(booking.status)).length;

  return (
    <div className="page-shell trips-page">
      <main>
        <section className="trips-hero">
          <div className="container">
            <p className="eyebrow">Your TravelHub dashboard</p>
            <h1>Manage stays, taxi rides, and upcoming Azerbaijan plans in one place.</h1>
          </div>
        </section>

        <section className="container trips-shell">
          <aside className="trip-sidebar">
            <nav className="trip-nav" aria-label="Trip filters">
              <button className="is-active" type="button">
                All bookings <span className="trip-count">{allCount}</span>
              </button>
              <button type="button">
                Hotels <span className="trip-count">{bookings.length}</span>
              </button>
              <button type="button">
                Taxi rides <span className="trip-count">{taxiBookings.length}</span>
              </button>
              <button type="button">
                Awaiting driver <span className="trip-count">{pendingCount}</span>
              </button>
            </nav>
          </aside>

          <div>
            <div className="trip-summary">
              <div className="summary-cell">
                <span>Total bookings</span>
                <strong>{allCount}</strong>
              </div>
              <div className="summary-cell">
                <span>Paid</span>
                <strong>{paidCount}</strong>
              </div>
              <div className="summary-cell">
                <span>Awaiting driver</span>
                <strong>{pendingCount}</strong>
              </div>
            </div>

            <div className="trip-list">
              {(bookingsLoading || taxiBookingsLoading) && <p className="empty">Loading your trips...</p>}

              {bookings.map((booking) => (
                <article className="trip-card" key={`hotel-${booking.id}`}>
                  <img src="/assets/hero-baku.jpg" alt={booking.hotelName} />
                  <div>
                    <div className="trip-meta">
                      <span className={`status ${booking.status === 'PendingPayment' ? 'pending' : 'confirmed'}`}>
                        {booking.status}
                      </span>
                      <span className="muted">Hotel booking #{booking.id}</span>
                    </div>
                    <h2>{booking.hotelName}</h2>
                    <p>
                      {booking.roomType} / {booking.checkInDate} - {booking.checkOutDate}
                    </p>
                    <small>
                      {booking.customerName} / {formatMoney(booking.totalPrice)}
                    </small>
                  </div>
                  <div className="trip-actions">
                    {booking.status === 'PendingPayment' && payingBookingId !== booking.id && (
                      <>
                        <button className="btn btn-primary" disabled={submitting} onClick={() => onOpenPaymentForm(booking.id)} type="button">
                          Pay now
                        </button>
                        <button className="btn btn-secondary" disabled={submitting} onClick={() => void onCancelBooking(booking)} type="button">
                          Cancel
                        </button>
                      </>
                    )}
                    {booking.status !== 'PendingPayment' && (
                      <button className="btn btn-secondary" onClick={() => onNavigate('hotels')} type="button">
                        Book again
                      </button>
                    )}
                  </div>
                  {booking.status === 'PendingPayment' && payingBookingId === booking.id && renderPaymentForm(booking)}
                </article>
              ))}

              {taxiBookings.map((booking) => (
                <article className="trip-card" key={`taxi-${booking.id}`}>
                  <img src="/assets/destination-ganja.jpg" alt={booking.taxiServiceName} />
                  <div>
                    <div className="trip-meta">
                      <span className={`status ${booking.status === 'AwaitingDriver' ? 'pending' : 'upcoming'}`}>
                        {booking.status}
                      </span>
                      <span className="muted">Taxi booking #{booking.id}</span>
                    </div>
                    <h2>{booking.taxiServiceName}</h2>
                    <p>
                      {booking.pickupAddress} to {booking.dropoffAddress}
                    </p>
                    <small>
                      {formatTaxiCarClassName(booking.carClassName)} / {booking.distanceKm.toFixed(2)} km /{' '}
                      {formatMoney(booking.totalPrice)}
                    </small>
                  </div>
                  <div className="trip-actions">
                    {booking.status === 'AwaitingDriver' && (
                      <button className="btn btn-secondary" disabled={submitting} onClick={() => void onCancelTaxiBooking(booking)} type="button">
                        Cancel request
                      </button>
                    )}
                    {booking.status !== 'AwaitingDriver' && (
                      <button className="btn btn-secondary" onClick={() => onNavigate('taxi')} type="button">
                        Book taxi
                      </button>
                    )}
                  </div>
                  {booking.driverName && <small className="trip-driver">Driver: {booking.driverName}{booking.driverPhoneNumber ? ` / ${booking.driverPhoneNumber}` : ''}</small>}
                </article>
              ))}

              {!bookingsLoading && !taxiBookingsLoading && allCount === 0 && (
                <article className="trip-card">
                  <img src="/assets/destination-gabala.jpg" alt="Gabala mountains" />
                  <div>
                    <div className="trip-meta">
                      <span className="status upcoming">Ready</span>
                      <span className="muted">No trips yet</span>
                    </div>
                    <h2>Your bookings will appear here</h2>
                    <p>Book a hotel or taxi ride, then return to this dashboard.</p>
                  </div>
                  <div className="trip-actions">
                    <button className="btn btn-primary" onClick={() => onNavigate('hotels')} type="button">
                      Find stays
                    </button>
                    <button className="btn btn-secondary" onClick={() => onNavigate('taxi')} type="button">
                      Open taxi
                    </button>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
