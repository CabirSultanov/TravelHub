import type { FormEvent, ReactNode } from 'react';
import RoomPhotoFields from '../../components/hotels/RoomPhotoFields';
import { formatMoney } from '../../utils/formatting';
import { fallbackImage, roomImageUrls, roomMainImage } from '../../utils/images';
import type {
  AuthUser,
  Booking,
  BookingForm,
  BookingGuestMode,
  DeleteTarget,
  Hotel,
  HotelForm,
  HotelRoom,
  HotelRoomForm,
} from '../../types';

type HotelsPageProps = {
  visibleHotels: Hotel[];
  cities: string[];
  rooms: HotelRoom[];
  selectedHotel: Hotel | null;
  selectedRoom: HotelRoom | null;
  booking: Booking | null;
  hotelForm: HotelForm;
  roomForm: HotelRoomForm;
  bookingForm: BookingForm;
  cityFilter: string;
  editingHotelId: number | null;
  editingRoomId: number | null;
  showHotelForm: boolean;
  showRoomForm: boolean;
  loading: boolean;
  roomsLoading: boolean;
  submitting: boolean;
  currentUser: AuthUser | null;
  canManageHotels: boolean;
  phoneNumberPattern: string;
  bookingGuestMode: BookingGuestMode;
  renderPaymentForm: (booking: Booking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onStartCreateHotel: () => void;
  onCityFilterChange: (city: string) => void;
  onSelectHotel: (hotel: Hotel) => void;
  onSetDeleteTarget: (target: DeleteTarget) => void;
  onHotelFormChange: (form: HotelForm) => void;
  onSubmitHotel: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateHotelFormRoom: (index: number, update: Partial<HotelRoomForm>) => void;
  onAddHotelFormRoom: () => void;
  onRemoveHotelFormRoom: (index: number) => void;
  onUpdateHotelRoomImageUrl: (roomIndex: number, imageIndex: number, imageUrl: string) => void;
  onAddHotelRoomImageUrl: (roomIndex: number) => void;
  onRemoveHotelRoomImageUrl: (roomIndex: number, imageIndex: number) => void;
  onEditHotel: (hotel: Hotel) => void;
  onStartCreateRoom: () => void;
  onEditHotelRoom: (room: HotelRoom) => void;
  onRoomFormChange: (form: HotelRoomForm) => void;
  onSubmitHotelRoom: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateRoomImageUrl: (index: number, imageUrl: string) => void;
  onAddRoomImageUrl: () => void;
  onRemoveRoomImageUrl: (index: number) => void;
  onCancelHotelForm: () => void;
  onCancelRoomForm: () => void;
  onSelectRoom: (room: HotelRoom) => void;
  onSelectBookingGuestMode: (mode: BookingGuestMode) => void;
  onBookingFormChange: (form: BookingForm) => void;
  onSubmitBooking: (event: FormEvent<HTMLFormElement>) => void;
  onOpenAuth: () => void;
  onResetFlow: () => void;
};

export default function HotelsPage({
  visibleHotels,
  cities,
  rooms,
  selectedHotel,
  selectedRoom,
  booking,
  hotelForm,
  roomForm,
  bookingForm,
  cityFilter,
  editingHotelId,
  editingRoomId,
  showHotelForm,
  showRoomForm,
  loading,
  roomsLoading,
  submitting,
  currentUser,
  canManageHotels,
  phoneNumberPattern,
  bookingGuestMode,
  renderPaymentForm,
  onStartCreateHotel,
  onCityFilterChange,
  onSelectHotel,
  onSetDeleteTarget,
  onHotelFormChange,
  onSubmitHotel,
  onUpdateHotelFormRoom,
  onAddHotelFormRoom,
  onRemoveHotelFormRoom,
  onUpdateHotelRoomImageUrl,
  onAddHotelRoomImageUrl,
  onRemoveHotelRoomImageUrl,
  onEditHotel,
  onStartCreateRoom,
  onEditHotelRoom,
  onRoomFormChange,
  onSubmitHotelRoom,
  onUpdateRoomImageUrl,
  onAddRoomImageUrl,
  onRemoveRoomImageUrl,
  onCancelHotelForm,
  onCancelRoomForm,
  onSelectRoom,
  onSelectBookingGuestMode,
  onBookingFormChange,
  onSubmitBooking,
  onOpenAuth,
  onResetFlow,
}: HotelsPageProps) {
  return (
    <section className="hotel-page">
      <aside className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Hotels</p>
            <h2>Hotel booking</h2>
          </div>
          <span>{loading ? 'Loading' : `${visibleHotels.length} available`}</span>
        </div>

        {canManageHotels && !showHotelForm && (
          <button className="primary" onClick={onStartCreateHotel} type="button">
            Create hotel
          </button>
        )}

        <label className="filter">
          City
          <select value={cityFilter} onChange={(event) => onCityFilterChange(event.target.value)}>
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
              <button className="hotel-card-main" onClick={() => onSelectHotel(hotel)} type="button">
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
                  onClick={() => onSetDeleteTarget({ kind: 'hotel', id: hotel.id, name: hotel.name })}
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
          <h2>{showHotelForm ? (editingHotelId ? 'Edit hotel' : 'Create hotel') : selectedHotel ? selectedHotel.name : 'Select a hotel'}</h2>
          {!showHotelForm && selectedHotel && <span>{selectedHotel.city}</span>}
        </div>

        {showHotelForm && canManageHotels ? (
          <form className="form-grid hotel-create-form" onSubmit={(event) => void onSubmitHotel(event)}>
            <h3>{editingHotelId ? 'Edit hotel details' : 'Hotel details'}</h3>
            <label className="field-label">
              Name
              <input
                placeholder="Hotel name"
                value={hotelForm.name}
                onChange={(event) => onHotelFormChange({ ...hotelForm, name: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              City
              <input
                placeholder="City"
                value={hotelForm.city}
                onChange={(event) => onHotelFormChange({ ...hotelForm, city: event.target.value })}
                required
              />
            </label>
            <label className="field-label">
              Description
              <input
                placeholder="Hotel description"
                value={hotelForm.description}
                onChange={(event) => onHotelFormChange({ ...hotelForm, description: event.target.value })}
              />
            </label>
            <label className="field-label">
              Hotel image URL
              <input
                placeholder="Image URL"
                type="url"
                value={hotelForm.imageUrl}
                onChange={(event) => onHotelFormChange({ ...hotelForm, imageUrl: event.target.value })}
              />
            </label>

            {editingHotelId === null && (
              <>
                <div className="room-types-header">
                  <h3>Room types</h3>
                  <span>{hotelForm.rooms.reduce((total, room) => total + Number(room.capacity || 0) * Number(room.totalRooms || 0), 0)} places</span>
                </div>

                {hotelForm.rooms.map((room, index) => (
                  <section className="room-form-panel" key={index}>
                    <div className="section-title">
                      <h3>Room type {index + 1}</h3>
                      <span>{Number(room.capacity || 0) * Number(room.totalRooms || 0)} places</span>
                    </div>
                    <label className="field-label">
                      Room type
                      <input
                        placeholder="Standard room"
                        value={room.roomType}
                        onChange={(event) => onUpdateHotelFormRoom(index, { roomType: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field-label">
                      Capacity
                      <input
                        min="1"
                        placeholder="Guests count"
                        type="number"
                        value={room.capacity}
                        onChange={(event) => onUpdateHotelFormRoom(index, { capacity: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field-label">
                      Total rooms
                      <input
                        min="1"
                        placeholder="How many rooms"
                        type="number"
                        value={room.totalRooms}
                        onChange={(event) => onUpdateHotelFormRoom(index, { totalRooms: event.target.value })}
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
                        value={room.pricePerNight}
                        onChange={(event) => onUpdateHotelFormRoom(index, { pricePerNight: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field-label">
                      Description
                      <input
                        placeholder="Room description"
                        value={room.description}
                        onChange={(event) => onUpdateHotelFormRoom(index, { description: event.target.value })}
                        required
                      />
                    </label>
                    <RoomPhotoFields
                      imageUrls={room.imageUrls}
                      onAdd={() => onAddHotelRoomImageUrl(index)}
                      onChange={(imageIndex, imageUrl) => onUpdateHotelRoomImageUrl(index, imageIndex, imageUrl)}
                      onRemove={(imageIndex) => onRemoveHotelRoomImageUrl(index, imageIndex)}
                    />
                    <label className="checkbox">
                      <input
                        checked={room.isAvailable}
                        type="checkbox"
                        onChange={(event) => onUpdateHotelFormRoom(index, { isAvailable: event.target.checked })}
                      />
                      Available for booking
                    </label>
                    <button
                      className="link-button"
                      disabled={hotelForm.rooms.length <= 2}
                      onClick={() => onRemoveHotelFormRoom(index)}
                      type="button"
                    >
                      Remove room type
                    </button>
                  </section>
                ))}

                <button className="link-button" onClick={onAddHotelFormRoom} type="button">
                  Add room type
                </button>
              </>
            )}

            <button className="primary" disabled={submitting} type="submit">
              {editingHotelId ? 'Save hotel' : 'Create hotel'}
            </button>
            <button className="link-button" disabled={submitting} onClick={onCancelHotelForm} type="button">
              Cancel
            </button>
          </form>
        ) : selectedHotel ? (
          <>
            <img
              className="selected-hotel-image"
              src={selectedHotel.imageUrl || fallbackImage(selectedHotel.name, 'hotel')}
              alt=""
            />
            {selectedHotel.description && <p className="description">{selectedHotel.description}</p>}

            {canManageHotels && (
              <>
                {!showRoomForm && (
                  <div className="hotel-actions">
                    <button className="small-primary-button" onClick={() => onEditHotel(selectedHotel)} type="button">
                      Edit hotel
                    </button>
                    <button className="small-primary-button" onClick={onStartCreateRoom} type="button">
                      Create room
                    </button>
                  </div>
                )}

                {showRoomForm && (
                  <form className="form-grid" onSubmit={(event) => void onSubmitHotelRoom(event)}>
                    <h3>{editingRoomId ? 'Edit room' : 'Create room'}</h3>
                    <label className="field-label">
                      Room type
                      <input
                        placeholder="Standard room"
                        value={roomForm.roomType}
                        onChange={(event) => onRoomFormChange({ ...roomForm, roomType: event.target.value })}
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
                        onChange={(event) => onRoomFormChange({ ...roomForm, capacity: event.target.value })}
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
                        onChange={(event) => onRoomFormChange({ ...roomForm, totalRooms: event.target.value })}
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
                        onChange={(event) => onRoomFormChange({ ...roomForm, pricePerNight: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field-label">
                      Description
                      <input
                        placeholder="Room description"
                        value={roomForm.description}
                        onChange={(event) => onRoomFormChange({ ...roomForm, description: event.target.value })}
                        required
                      />
                    </label>
                    <RoomPhotoFields
                      imageUrls={roomForm.imageUrls}
                      onAdd={onAddRoomImageUrl}
                      onChange={onUpdateRoomImageUrl}
                      onRemove={onRemoveRoomImageUrl}
                    />
                    <label className="checkbox">
                      <input
                        checked={roomForm.isAvailable}
                        type="checkbox"
                        onChange={(event) => onRoomFormChange({ ...roomForm, isAvailable: event.target.checked })}
                      />
                      Available for booking
                    </label>
                    <button className="primary" disabled={submitting} type="submit">
                      {editingRoomId ? 'Save room' : 'Create room'}
                    </button>
                    <button className="link-button" onClick={onCancelRoomForm} type="button">
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
                    onClick={() => onSelectRoom(room)}
                    type="button"
                  >
                    <img src={roomMainImage(room)} alt="" />
                    <span>
                      <strong>{room.roomType}</strong>
                      <small>
                        {room.capacity} guests / {room.totalRooms} rooms / {formatMoney(room.pricePerNight)}
                      </small>
                    </span>
                  </button>
                  {canManageHotels && (
                    <div className="card-actions">
                      <button disabled={submitting} onClick={() => onEditHotelRoom(room)} type="button">
                        Edit
                      </button>
                      <button
                        disabled={submitting}
                        onClick={() => onSetDeleteTarget({ kind: 'room', id: room.id, name: room.roomType })}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {roomsLoading && <p className="empty">Loading rooms...</p>}
            {!roomsLoading && rooms.length === 0 && <p className="empty">No rooms for this hotel yet.</p>}

            {selectedRoom && roomImageUrls(selectedRoom).length > 0 && (
              <div className="room-photo-strip">
                {roomImageUrls(selectedRoom).map((imageUrl) => (
                  <img src={imageUrl} alt="" key={imageUrl} />
                ))}
              </div>
            )}

            {selectedRoom && !booking && !currentUser && (
              <div className="form-grid">
                <h3>{selectedRoom.roomType} booking</h3>
                <p className="empty">Please register or sign in to create a booking.</p>
                <button className="primary" onClick={onOpenAuth} type="button">
                  Register to book
                </button>
              </div>
            )}

            {selectedRoom && !booking && currentUser && (
              <form className="form-grid" onSubmit={(event) => void onSubmitBooking(event)}>
                <h3>{selectedRoom.roomType} booking</h3>
                <div className="booking-mode">
                  <button
                    className={bookingGuestMode === 'self' ? 'active' : ''}
                    onClick={() => onSelectBookingGuestMode('self')}
                    type="button"
                  >
                    Book for myself
                  </button>
                  <button
                    className={bookingGuestMode === 'other' ? 'active' : ''}
                    onClick={() => onSelectBookingGuestMode('other')}
                    type="button"
                  >
                    Book for someone else
                  </button>
                </div>
                <input
                  placeholder="Customer name"
                  value={bookingForm.customerName}
                  onChange={(event) => onBookingFormChange({ ...bookingForm, customerName: event.target.value })}
                  required
                />
                <input
                  pattern={phoneNumberPattern}
                  placeholder="Phone number"
                  type="tel"
                  value={bookingForm.phoneNumber}
                  onChange={(event) => onBookingFormChange({ ...bookingForm, phoneNumber: event.target.value })}
                  required
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={bookingForm.email}
                  onChange={(event) => onBookingFormChange({ ...bookingForm, email: event.target.value })}
                  required
                />
                <input
                  type="date"
                  value={bookingForm.checkInDate}
                  onChange={(event) => onBookingFormChange({ ...bookingForm, checkInDate: event.target.value })}
                  required
                />
                <input
                  type="date"
                  value={bookingForm.checkOutDate}
                  onChange={(event) => onBookingFormChange({ ...bookingForm, checkOutDate: event.target.value })}
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

                {booking.status === 'PendingPayment' && renderPaymentForm(booking)}

                {booking.status !== 'PendingPayment' && (
                  <button className="primary" onClick={onResetFlow} type="button">
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
  );
}
