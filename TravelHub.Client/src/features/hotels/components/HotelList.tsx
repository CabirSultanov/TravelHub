import type { Hotel } from '../../../types';
import Pagination from '../../../components/common/Pagination';
import { hotelMainImage } from '../../../utils/images';
import type { HotelsFeatureActions } from '../hotels.types';

type HotelListProps = {
  hotels: Hotel[];
  selectedHotel: Hotel | null;
  cityFilter: string;
  hotelPage: number;
  hotelTotalItems: number;
  hotelTotalPages: number;
  showHotelForm: boolean;
  loading: boolean;
  canManageHotels: boolean;
  submitting: boolean;
  actions: HotelsFeatureActions['hotelList'];
  onOpenHotel: (hotel: Hotel) => void;
  onPageChange: (page: number) => void;
};

export default function HotelList({
  hotels,
  selectedHotel,
  cityFilter,
  hotelPage,
  hotelTotalItems,
  hotelTotalPages,
  showHotelForm,
  loading,
  canManageHotels,
  submitting,
  actions,
  onOpenHotel,
  onPageChange,
}: HotelListProps) {
  const heading = cityFilter ? `Hotels in ${cityFilter}` : 'Hotels in Azerbaijan';

  return (
    <section className="container od-results-section">
      <div className="results-head">
        <div>
          <h2>{heading}</h2>
          <span className="count">{loading ? 'Loading stays...' : `${hotelTotalItems} stays available`}</span>
        </div>
        {canManageHotels && !showHotelForm && (
          <button className="btn btn-primary" onClick={actions.startCreate} type="button">
            Create hotel
          </button>
        )}
      </div>

      <div className="results">
        {hotels.map((hotel) => (
          <article className={`hresult ${selectedHotel?.id === hotel.id ? 'is-selected' : ''}`} key={hotel.id}>
            <button className="hresult-photo" onClick={() => onOpenHotel(hotel)} type="button">
              <img src={hotelMainImage(hotel)} alt="" />
              <span className="hresult-badge badge badge-glass">
                {selectedHotel?.id === hotel.id ? 'Selected stay' : 'Available stay'}
              </span>
            </button>
            <div className="hresult-body">
              <div className="hresult-topline">
                <div>
                  <h2>{hotel.name}</h2>
                  <span className="hresult-loc">{hotel.city}, Azerbaijan</span>
                </div>
              </div>
              {hotel.description && <p className="hresult-desc">{hotel.description}</p>}
              <div className="amenity-row">
                <span className="amenity-tag">{hotel.totalGuestPlaces} guest places</span>
                <span className="amenity-tag">{hotel.roomTypesCount} room types</span>
                <span className="amenity-tag">{hotel.totalRoomsCount} rooms</span>
              </div>
            </div>
            <div className="hresult-side">
              <button className="btn btn-primary" onClick={() => onOpenHotel(hotel)} type="button">
                View rooms
              </button>
              {canManageHotels && (
                <button
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => actions.requestDelete({ kind: 'hotel', id: hotel.id, name: hotel.name })}
                  type="button"
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}

        {!loading && hotelTotalItems === 0 && <p className="empty">No hotels yet.</p>}
      </div>
      <Pagination
        ariaLabel="Hotel results pagination"
        className="hotel-pagination user-pagination"
        disabled={loading}
        onPageChange={onPageChange}
        page={hotelPage}
        totalPages={hotelTotalPages}
      />
    </section>
  );
}
