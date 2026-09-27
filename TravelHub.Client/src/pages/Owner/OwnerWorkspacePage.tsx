import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import Pagination from '../../components/common/Pagination';
import OwnerBookings from './OwnerBookings';
import OwnerHotelEditor from './OwnerHotelEditor';
import OwnerReviews from './OwnerReviews';
import { useOwnerQuery } from './useOwnerQuery';
import './owner.css';

const sections = { overview: 'Overview', bookings: 'Bookings', hotels: 'Hotels & rooms', reviews: 'Reviews' } as const;
type Section = keyof typeof sections;
type Drill = 'arrivals' | 'departures' | 'awaiting';
type Props = {
  accountKey: string;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
  beforeNavigate: () => boolean;
};

export async function loadOwnedHotels(signal?: AbortSignal) {
  const first = await api.getOwnerHotels({ page: 1, pageSize: 100 }, signal);
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    items.push(...(await api.getOwnerHotels({ page, pageSize: 100 }, signal)).items);
  }
  return items;
}

export default function OwnerWorkspacePage({ accountKey, onStateChange, beforeNavigate }: Props) {
  const [section, setSection] = useState<Section>('overview');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Drill>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editorState, setEditorState] = useState({ dirty: false, busy: false });
  const [accessMessage, setAccessMessage] = useState('');
  const data = useOwnerQuery(`${accountKey}:hotels`, loadOwnedHotels);
  const callbacks = useRef({ onStateChange });
  callbacks.current = { onStateChange };
  const hotels = data.data ?? [];
  const selectedHotel = hotels.find((h) => h.id === selectedId);
  const editingHotel = hotels.find((h) => h.id === editingId);

  useEffect(() => () => callbacks.current.onStateChange({ dirty: false, busy: false }), []);
  useEffect(() => {
    if (data.accessDenied || (data.data && editingId !== null && !editingHotel)) {
      setEditingId(null);
      setEditorState({ dirty: false, busy: false });
      callbacks.current.onStateChange({ dirty: false, busy: false });
      setAccessMessage('Hotel access changed. Refresh your hotels or contact an administrator.');
    }
  }, [data.accessDenied, data.data, editingId, editingHotel]);

  function reportState(next: typeof editorState) {
    setEditorState(next);
    onStateChange(next);
  }
  function changeSection(next: Section, drill?: Drill) {
    if (!beforeNavigate()) return;
    reportState({ dirty: false, busy: false });
    setEditingId(null);
    setSection(next);
    setFilter(drill);
    setAccessMessage('');
  }
  function chooseHotel(id: number | null) {
    if (!beforeNavigate()) return;
    reportState({ dirty: false, busy: false });
    setSelectedId(id);
    setEditingId(null);
    setAccessMessage('');
  }
  function lostAccess() {
    reportState({ dirty: false, busy: false });
    setEditingId(null);
    setAccessMessage('Hotel access changed. The editor has been closed.');
    void data.reload().catch(() => undefined);
  }
  const filteredHotels = hotels.filter((h) => `${h.name} ${h.city}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.ceil(filteredHotels.length / 20);
  const visiblePage = Math.min(page, Math.max(1, totalPages));
  const invalidSelection = selectedId !== null && !selectedHotel;

  return (
    <main className="container owner-workspace">
      <header className="owner-workspace-heading">
        <div><p className="owner-eyebrow">TRAVELHUB · YOUR BUSINESS</p><h1>Hotel workspace</h1><p className="owner-muted">Your hotels, reservations and guest feedback — in one place.</p></div>
        <span className="owner-workspace-tag">Hotel owner</span>
      </header>
      <div className="owner-layout">
        <nav className="owner-nav" aria-label="Hotel workspace sections">
          {Object.entries(sections).map(([key, label]) => <button type="button" key={key}
            aria-current={section === key ? 'page' : undefined} disabled={editorState.busy}
            onClick={() => changeSection(key as Section)}>{label}</button>)}
          <p>Manage only the hotels assigned to your account.</p>
        </nav>
        <div className="owner-content">
          <div className="owner-toolbar">
            <label className="owner-field">Hotel
              <select value={selectedId ?? ''} disabled={editorState.busy || !data.data} onChange={(e) => chooseHotel(e.target.value ? Number(e.target.value) : null)}>
                <option value="">All my hotels</option>
                {invalidSelection && <option value={selectedId!}>Hotel no longer assigned</option>}
                {hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name} · {hotel.city}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-secondary" disabled={data.refreshing || editorState.busy}
              onClick={() => void data.reload().catch(() => undefined)}>{data.refreshing ? 'Refreshing…' : 'Refresh hotels'}</button>
          </div>
          {data.error && <p className="owner-notice" role="alert">{data.error}</p>}
          {accessMessage && <p className="owner-notice" role="status">{accessMessage}</p>}
          {data.loading && <div className="owner-empty" role="status">Loading your hotels…</div>}
          {data.data && hotels.length === 0 && <div className="owner-empty"><h2>No hotels assigned</h2><p>Ask an administrator to assign your hotels to this account.</p></div>}
          {data.data && hotels.length > 0 && invalidSelection && <div className="owner-empty"><h2>Hotel no longer assigned</h2><p>Select another hotel to continue.</p></div>}
          {data.data && hotels.length > 0 && !invalidSelection && <>
            {section === 'overview' && <Overview key={`${accountKey}:${selectedId}`} accountKey={accountKey} hotelId={selectedId} onOpen={(drill) => changeSection('bookings', drill)} />}
            {section === 'bookings' && <OwnerBookings key={`${accountKey}:${selectedId}:${filter}`} accountKey={accountKey} hotelId={selectedId} initialFilter={filter} />}
            {section === 'hotels' && (editingHotel ? <>
              <button type="button" className="btn btn-secondary owner-back" disabled={editorState.busy} onClick={() => { if (beforeNavigate()) { reportState({ dirty: false, busy: false }); setEditingId(null); } }}>Back to hotels</button>
              <OwnerHotelEditor key={`${accountKey}:${editingHotel.id}`} hotel={editingHotel} onStateChange={reportState} onAccessLost={lostAccess}
                onChanged={async () => { await api.getOwnerOverview(editingHotel.id); await data.reload(); }} />
            </> : <section className="owner-section">
              <div className="owner-section-header"><div><h2>Hotels &amp; rooms</h2><p className="owner-muted">Update details and room types. Existing reservations keep their saved price.</p></div></div>
              <label className="owner-field owner-search">Search hotels<input type="search" value={search} placeholder="Hotel name or city" onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
              <div className="owner-hotel-list">{filteredHotels.filter((hotel) => selectedId === null || hotel.id === selectedId).slice(selectedId === null ? (visiblePage - 1) * 20 : 0, selectedId === null ? visiblePage * 20 : 20).map((hotel) => <article className="owner-hotel-card" key={hotel.id}>
                <div><p className="owner-eyebrow">{hotel.city}</p><h3>{hotel.name}</h3><p className="owner-muted">{hotel.roomTypesCount} room types · {hotel.totalRoomsCount} rooms</p></div>
                <button className="btn btn-primary" type="button" onClick={() => setEditingId(hotel.id)}>Manage hotel</button>
              </article>)}</div>
              {filteredHotels.filter((h) => selectedId === null || h.id === selectedId).length === 0 && <p className="owner-empty">No hotels match your search.</p>}
              {selectedId === null && <Pagination page={visiblePage} totalPages={totalPages} onPageChange={setPage} ariaLabel="Your hotels pages" />}
            </section>)}
            {section === 'reviews' && (selectedHotel ? <OwnerReviews key={`${accountKey}:${selectedHotel.id}`} hotel={selectedHotel} accountKey={accountKey} /> : <div className="owner-empty"><h2>Guest reviews</h2><p>Select a hotel above to read its guest feedback.</p></div>)}
          </>}
        </div>
      </div>
    </main>
  );
}

function Overview({ accountKey, hotelId, onOpen }: { accountKey: string; hotelId: number | null; onOpen: (filter: Drill) => void }) {
  const data = useOwnerQuery(`${accountKey}:${hotelId}:overview`, (signal) => api.getOwnerOverview(hotelId ?? undefined, signal), 30_000);
  return <section className="owner-section">
    <div className="owner-section-header"><div><h2>Today at your hotels</h2><p className="owner-muted">Planned stays, not actual check-ins. {data.data?.today ? `${data.data.today} · Baku time` : 'Dates follow Baku time.'}</p></div><button className="btn btn-secondary" type="button" disabled={data.refreshing} onClick={() => void data.reload().catch(() => undefined)}>Refresh overview</button></div>
    {data.error && <p className="owner-notice" role="alert">{data.error}</p>}
    {data.loading && <p role="status" className="owner-empty">Loading overview…</p>}
    {data.data && <>
      <div className="owner-metrics">
        <button type="button" onClick={() => onOpen('arrivals')}><span>Arrivals today</span><strong>{data.data.arrivalsToday}</strong><small>Paid reservations →</small></button>
        <button type="button" onClick={() => onOpen('departures')}><span>Departures today</span><strong>{data.data.departuresToday}</strong><small>Paid reservations →</small></button>
        <button type="button" onClick={() => onOpen('awaiting')}><span>Awaiting payment</span><strong>{data.data.awaitingPayment}</strong><small>Current &amp; upcoming stays →</small></button>
      </div>
      <div className="owner-section-header"><h3>Upcoming arrivals</h3><span className="owner-muted">Next 5 paid reservations</span></div>
      {data.data.upcomingArrivals.length === 0 ? <p className="owner-empty">No upcoming paid arrivals.</p> : <div className="owner-arrivals">{data.data.upcomingArrivals.map((booking) => <article key={booking.id}>
        <div><strong>{booking.customerName}</strong><span>{booking.hotelName} · {booking.roomType}</span></div><div><span>{booking.checkInDate} → {booking.checkOutDate}</span><small>Booking #{booking.id}</small></div>
      </article>)}</div>}
    </>}
  </section>;
}
