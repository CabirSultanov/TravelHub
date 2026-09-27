import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api';
import Pagination from '../../components/common/Pagination';
import type { BookingStatus, PagedResponse } from '../../types';
import { formatReviewTimestamp } from '../../utils/relativeTime';
import type { OwnerBooking, OwnerBookingFilters } from './ownerTypes';
import { useOwnerQuery } from './useOwnerQuery';

type Props = { hotelId: number | null; initialFilter?: 'arrivals' | 'departures' | 'awaiting'; accountKey: string };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const statusLabels: Record<BookingStatus, string> = { PendingPayment: 'Awaiting payment', Paid: 'Paid', Cancelled: 'Cancelled' };
const statusClasses: Record<BookingStatus, string> = { PendingPayment: 'is-pending', Paid: 'is-paid', Cancelled: 'is-cancelled' };

export default function OwnerBookings(props: Props) {
  return <BookingList key={JSON.stringify([props.accountKey, props.hotelId, props.initialFilter])} {...props} />;
}

function BookingList({ hotelId, initialFilter, accountKey }: Props) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState<OwnerBookingFilters>(() => ({
    period: initialFilter === 'arrivals' || initialFilter === 'departures' ? initialFilter : 'upcoming',
    status: initialFilter === 'awaiting' ? 'PendingPayment' : initialFilter ? 'Paid' : undefined,
    page: 1, pageSize: 20,
  }));
  const [selection, setSelection] = useState<{ id: number; key: string } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, search: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const request = { ...filters, hotelId: hotelId ?? undefined };
  const key = JSON.stringify(['owner-bookings', accountKey, request]);
  const query = useOwnerQuery<PagedResponse<OwnerBooking>>(key, (signal) => api.getOwnerBookings(request, signal), 30_000);
  const response = query.accessDenied ? null : query.data;
  const busy = query.loading || query.refreshing;
  const changeFilters = (patch: Partial<OwnerBookingFilters>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from && to && from > to) return;
    changeFilters({ from: from || undefined, to: to || undefined });
  }

  function clearFilters() {
    setSearch(''); setFrom(''); setTo('');
    setFilters({ period: 'upcoming', page: 1, pageSize: 20 });
  }

  return (
    <section className="owner-section" aria-labelledby="owner-bookings-title">
      <div className="owner-section-header">
        <div><h2 id="owner-bookings-title">Bookings</h2><p className="owner-muted">Scheduled stays. Today’s arrivals and departures use Baku time.</p></div>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void query.reload().catch(() => undefined)} type="button">{query.refreshing ? 'Refreshing…' : 'Refresh bookings'}</button>
      </div>
      <div className="owner-filters">
        <label className="owner-field owner-search">Search bookings
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Booking ID, guest, email or phone" type="search" value={search} />
        </label>
        <label className="owner-field">Payment status
          <select onChange={(event) => changeFilters({ status: event.target.value as BookingStatus || undefined })} value={filters.status ?? ''}>
            <option value="">All statuses</option><option value="PendingPayment">Awaiting payment</option><option value="Paid">Paid</option><option value="Cancelled">Cancelled</option>
          </select>
        </label>
        <label className="owner-field">Stay period
          <select onChange={(event) => changeFilters({ period: event.target.value as OwnerBookingFilters['period'] })} value={filters.period}>
            <option value="upcoming">Current &amp; upcoming</option><option value="past">Past stays</option><option value="all">All dates</option>
            <option value="arrivals">Arrivals today</option><option value="departures">Departures today</option>
          </select>
        </label>
      </div>
      <form className="owner-filter-actions" onSubmit={applyDates}>
        <fieldset className="owner-date-filters"><legend>Stay overlaps</legend>
          <label className="owner-field">From<input max={to || undefined} onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
          <label className="owner-field">Through<input min={from || undefined} onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
        </fieldset>
        <button className="btn btn-secondary" type="submit">Apply dates</button>
        <button className="btn btn-secondary" onClick={clearFilters} type="button">Clear filters</button>
      </form>
      {(filters.from || filters.to) && <p className="owner-muted">Stay overlaps {filters.from || 'any start date'} through {filters.to || 'any end date'}.</p>}
      {query.error && <div className="owner-notice" role="alert"><p>{query.error}</p>{response && <p>Showing the last loaded bookings.</p>}</div>}
      {query.loading && !response && <p className="owner-empty" role="status">Loading bookings…</p>}
      {!query.loading && !query.error && response?.totalItems === 0 && <p className="owner-empty">No bookings match these filters.</p>}
      {response && <>
        <p className="owner-muted" role="status">{response.totalItems} {response.totalItems === 1 ? 'booking' : 'bookings'} found{query.refreshing ? ' · Updating…' : ''}</p>
        <div className="owner-booking-list">
          {response.items.map((booking) => {
            const expanded = selection?.key === key && selection.id === booking.id;
            return <article className="owner-booking-card" key={booking.id}>
              <div className="owner-booking-summary">
                <div className="owner-booking-title"><span className="owner-muted">Booking #{booking.id}</span><h3>{booking.customerName}</h3><p>{booking.hotelName} · {booking.roomType}</p></div>
                <div className="owner-booking-stay"><span className="owner-muted">Scheduled stay</span><p><time dateTime={booking.checkInDate}>{booking.checkInDate}</time> → <time dateTime={booking.checkOutDate}>{booking.checkOutDate}</time></p></div>
                <div className="owner-booking-total"><strong>{money.format(booking.totalPrice)}</strong><span className={`owner-status ${statusClasses[booking.status]}`}>{statusLabels[booking.status]}</span></div>
                <button aria-controls={`owner-booking-${booking.id}`} aria-expanded={expanded} className="btn btn-secondary" onClick={() => setSelection(expanded ? null : { id: booking.id, key })} type="button">{expanded ? 'Hide details' : 'View details'}</button>
              </div>
              {expanded && <BookingDetails accountKey={accountKey} bookingId={booking.id} />}
            </article>;
          })}
        </div>
        <Pagination ariaLabel="Owner bookings pages" disabled={busy} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} page={response.page} totalPages={response.totalPages} />
      </>}
    </section>
  );
}

function BookingDetails({ bookingId, accountKey }: { bookingId: number; accountKey: string }) {
  const query = useOwnerQuery<OwnerBooking>(JSON.stringify(['owner-booking-detail', accountKey, bookingId]), (signal) => api.getOwnerBooking(bookingId, signal));
  const booking = query.accessDenied ? null : query.data;
  return <div aria-label={`Booking ${bookingId} details`} className="owner-booking-details" id={`owner-booking-${bookingId}`} role="region">
    <div className="owner-section-header"><h4>Booking details</h4><button className="btn btn-secondary" disabled={query.loading || query.refreshing} onClick={() => void query.reload().catch(() => undefined)} type="button">Refresh details</button></div>
    {query.loading && !booking && <p role="status">Loading booking details…</p>}
    {query.error && <div className="owner-notice" role="alert"><p>{query.error}</p>{booking && <p>Showing the last loaded details.</p>}</div>}
    {booking && <>
      <dl className="owner-detail-grid">
        <div><dt>Guest</dt><dd>{booking.customerName}</dd></div>
        <div><dt>Phone</dt><dd><a href={`tel:${booking.phoneNumber.replace(/[^+\d]/g, '')}`}>{booking.phoneNumber}</a></dd></div>
        <div><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></div>
        <div><dt>Hotel &amp; room type</dt><dd>{booking.hotelName} · {booking.roomType}</dd></div>
        <div><dt>Scheduled arrival</dt><dd><time dateTime={booking.checkInDate}>{booking.checkInDate}</time></dd></div>
        <div><dt>Scheduled departure</dt><dd><time dateTime={booking.checkOutDate}>{booking.checkOutDate}</time></dd></div>
        <div><dt>Booking total</dt><dd>{money.format(booking.totalPrice)}</dd></div>
        <div><dt>Payment status</dt><dd>{statusLabels[booking.status]}</dd></div>
        <div><dt>Paid at</dt><dd>{booking.paidAt ? <time dateTime={booking.paidAt}>{formatReviewTimestamp(booking.paidAt)}</time> : 'No payment recorded'}</dd></div>
        <div><dt>Cancelled at</dt><dd>{booking.cancelledAt ? <time dateTime={booking.cancelledAt}>{formatReviewTimestamp(booking.cancelledAt)}</time> : 'No cancellation recorded'}</dd></div>
      </dl>
      <p className="owner-muted">Payment status reflects the demo payment flow. Times are shown in your local time zone.</p>
    </>}
  </div>;
}
