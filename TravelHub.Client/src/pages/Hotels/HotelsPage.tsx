import type { ReactNode } from 'react';
import HotelBookingForm from '../../features/hotels/components/HotelBookingForm';
import HotelBookingResult from '../../features/hotels/components/HotelBookingResult';
import HotelForm from '../../features/hotels/components/HotelForm';
import HotelList from '../../features/hotels/components/HotelList';
import RoomForm from '../../features/hotels/components/RoomForm';
import RoomList from '../../features/hotels/components/RoomList';
import type { AuthUser, Booking, TaxiBooking } from '../../types';
import { fallbackImage } from '../../utils/images';
import type { HotelsFeature } from '../../features/hotels/hotels.types';

type HotelsPageProps = {
  feature: HotelsFeature;
  currentUser: AuthUser | null;
  submitting: boolean;
  loading: boolean;
  phoneNumberPattern: string;
  renderPaymentForm: (booking: Booking | TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onOpenAuth: () => void;
};

export default function HotelsPage({
  feature,
  currentUser,
  submitting,
  loading,
  phoneNumberPattern,
  renderPaymentForm,
  onOpenAuth,
}: HotelsPageProps) {
  const { model, actions } = feature;

  return (
    <section className="page od-hotels-page">
      <section className="hotels-hero">
        <div className="container">
          <div className="page-head">
            <div className="breadcrumb">
              <button onClick={() => actions.hotelList.setCityFilter('')} type="button">
                Explore
              </button>
              <span>Stays</span>
            </div>
            <h1 className="page-title">Find your perfect stay</h1>
            <p className="page-sub">Discover hotels across Azerbaijan and choose the room that fits your trip.</p>
          </div>

          <form className="search-bar" onSubmit={(event) => event.preventDefault()}>
            <label className="field">
              City
              <div className="field-control has-select">
                <select value={model.cityFilter} onChange={(event) => actions.hotelList.setCityFilter(event.target.value)}>
                  <option value="">All cities</option>
                  {model.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="field">
              Check-in
              <div className="field-control">
                <input type="date" />
              </div>
            </label>
            <label className="field">
              Check-out
              <div className="field-control">
                <input type="date" />
              </div>
            </label>
            <label className="field">
              Guests
              <div className="field-control has-select">
                <select defaultValue="2 guests">
                  <option>1 guest</option>
                  <option>2 guests</option>
                  <option>3 guests</option>
                  <option>4 guests</option>
                </select>
              </div>
            </label>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

          <div className="filter-row">
            <div className="chip-set" role="group" aria-label="Filter by city">
              <button className={`chip ${model.cityFilter === '' ? 'is-active' : ''}`} onClick={() => actions.hotelList.setCityFilter('')} type="button">
                All cities <span className="count">{model.visibleHotels.length}</span>
              </button>
              {model.cities.map((city) => (
                <button
                  className={`chip ${model.cityFilter === city ? 'is-active' : ''}`}
                  key={city}
                  onClick={() => actions.hotelList.setCityFilter(city)}
                  type="button"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HotelList
        actions={actions.hotelList}
        canManageHotels={model.canManageHotels}
        cities={model.cities}
        cityFilter={model.cityFilter}
        loading={loading}
        selectedHotel={model.selectedHotel}
        showHotelForm={model.showHotelForm}
        submitting={submitting}
        visibleHotels={model.visibleHotels}
      />

      <section className="container od-hotel-workspace">
        <div className="panel wide">
        <div className="section-title">
          <h2>{model.showHotelForm ? (model.editingHotelId ? 'Edit hotel' : 'Create hotel') : model.selectedHotel ? model.selectedHotel.name : 'Select a hotel'}</h2>
          {!model.showHotelForm && model.selectedHotel && <span>{model.selectedHotel.city}</span>}
        </div>

        {model.showHotelForm && model.canManageHotels ? (
          <HotelForm
            actions={actions.hotelForm}
            editingHotelId={model.editingHotelId}
            hotelForm={model.hotelForm}
            submitting={submitting}
          />
        ) : model.selectedHotel ? (
          <>
            <img
              className="selected-hotel-image"
              src={model.selectedHotel.imageUrl || fallbackImage(model.selectedHotel.name, 'hotel')}
              alt=""
            />
            {model.selectedHotel.description && <p className="description">{model.selectedHotel.description}</p>}

            {model.canManageHotels && (
              <>
                {!model.showRoomForm && (
                  <div className="hotel-actions">
                    <button className="small-primary-button" onClick={() => actions.hotelForm.edit(model.selectedHotel!)} type="button">
                      Edit hotel
                    </button>
                    <button className="small-primary-button" onClick={actions.roomForm.startCreate} type="button">
                      Create room
                    </button>
                  </div>
                )}

                {model.showRoomForm && (
                  <RoomForm
                    actions={actions.roomForm}
                    editingRoomId={model.editingRoomId}
                    roomForm={model.roomForm}
                    submitting={submitting}
                  />
                )}
              </>
            )}

            <RoomList
              actions={actions.roomList}
              canManageHotels={model.canManageHotels}
              rooms={model.rooms}
              roomsLoading={model.roomsLoading}
              selectedRoom={model.selectedRoom}
              submitting={submitting}
            />

            <HotelBookingForm
              actions={actions.booking}
              booking={model.booking}
              bookingForm={model.bookingForm}
              bookingGuestMode={model.bookingGuestMode}
              currentUser={currentUser}
              phoneNumberPattern={phoneNumberPattern}
              selectedRoom={model.selectedRoom}
              submitting={submitting}
              onOpenAuth={onOpenAuth}
            />

            <HotelBookingResult
              booking={model.booking}
              onReset={actions.booking.reset}
              renderPaymentForm={renderPaymentForm}
            />
          </>
        ) : (
          <p className="empty">Choose a hotel to see rooms and booking options.</p>
        )}
        </div>
      </section>
    </section>
  );
}
