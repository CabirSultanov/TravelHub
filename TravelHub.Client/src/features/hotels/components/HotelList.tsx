import type { Hotel } from '../../../types';
import { fallbackImage } from '../../../utils/images';
import type { HotelsFeatureActions } from '../hotels.types';

type HotelListProps = {
  visibleHotels: Hotel[];
  selectedHotel: Hotel | null;
  cities: string[];
  cityFilter: string;
  showHotelForm: boolean;
  loading: boolean;
  canManageHotels: boolean;
  submitting: boolean;
  actions: HotelsFeatureActions['hotelList'];
};

export default function HotelList({
  visibleHotels,
  selectedHotel,
  cities,
  cityFilter,
  showHotelForm,
  loading,
  canManageHotels,
  submitting,
  actions,
}: HotelListProps) {
  return (
    <aside className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Hotels</p>
          <h2>Hotel booking</h2>
        </div>
        <span>{loading ? 'Loading' : `${visibleHotels.length} available`}</span>
      </div>

      {canManageHotels && !showHotelForm && (
        <button className="primary" onClick={actions.startCreate} type="button">
          Create hotel
        </button>
      )}

      <label className="filter">
        City
        <select value={cityFilter} onChange={(event) => actions.setCityFilter(event.target.value)}>
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
          <article className={`hotel-card ${selectedHotel?.id === hotel.id ? 'active' : ''}`} key={hotel.id}>
            <button className="hotel-card-main" onClick={() => actions.select(hotel)} type="button">
              <img src={hotel.imageUrl || fallbackImage(hotel.name, 'hotel')} alt="" />
              <span>
                <strong>{hotel.name}</strong>
                <small>{hotel.city}</small>
                <span className="hotel-card-stats">
                  <small>{hotel.totalGuestPlaces} places</small>
                  <small>{hotel.roomTypesCount} types</small>
                  <small>{hotel.totalRoomsCount} rooms</small>
                </span>
              </span>
            </button>
            {canManageHotels && (
              <button
                className="hotel-delete-button"
                disabled={submitting}
                onClick={() => actions.requestDelete({ kind: 'hotel', id: hotel.id, name: hotel.name })}
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
  );
}
