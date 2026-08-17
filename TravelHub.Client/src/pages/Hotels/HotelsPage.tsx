import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import HotelBookingForm from '../../features/hotels/components/HotelBookingForm';
import HotelBookingResult from '../../features/hotels/components/HotelBookingResult';
import HotelForm from '../../features/hotels/components/HotelForm';
import HotelList from '../../features/hotels/components/HotelList';
import RoomForm from '../../features/hotels/components/RoomForm';
import RoomList, { RoomPhotoStrip } from '../../features/hotels/components/RoomList';
import SiteFooter from '../../components/common/SiteFooter';
import type { AuthUser, Booking, Hotel, Page, TaxiBooking } from '../../types';
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
  hotelDetailId: number | null;
  hotelDetailLoading: boolean;
  hotelDetailNotFound: boolean;
  blockedBackSignal: number;
  onBackToHotels: () => void;
  onNavigate: (page: Page) => void;
  onOpenHotel: (hotel: Hotel) => void;
  onShowDestinations: () => void;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDateInputDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return toDateInputValue(date);
}

export default function HotelsPage({
  feature,
  currentUser,
  submitting,
  loading,
  phoneNumberPattern,
  renderPaymentForm,
  onOpenAuth,
  hotelDetailId,
  hotelDetailLoading,
  hotelDetailNotFound,
  blockedBackSignal,
  onBackToHotels,
  onNavigate,
  onOpenHotel,
  onShowDestinations,
}: HotelsPageProps) {
  const { model, actions } = feature;
  const isHotelDetailPage = hotelDetailId !== null;
  const [showRooms, setShowRooms] = useState(false);
  const [searchCity, setSearchCity] = useState(model.cityFilter);
  const [searchDates, setSearchDates] = useState({ checkIn: '', checkOut: '' });
  const [showEditExitGuard, setShowEditExitGuard] = useState(false);
  const [navigateAfterEditSave, setNavigateAfterEditSave] = useState(false);
  const todayDate = toDateInputValue(new Date());
  const minCheckOutDate = addDateInputDays(searchDates.checkIn || todayDate, 1);
  const hasOpenEditForm = model.showHotelForm || model.showRoomForm;

  useEffect(() => {
    setShowRooms(false);
  }, [hotelDetailId]);

  useEffect(() => {
    if (blockedBackSignal > 0 && hasOpenEditForm) {
      setShowEditExitGuard(true);
    }
  }, [blockedBackSignal, hasOpenEditForm]);

  useEffect(() => {
    if (navigateAfterEditSave && !hasOpenEditForm) {
      setNavigateAfterEditSave(false);
      setShowEditExitGuard(false);
      onBackToHotels();
    }
  }, [hasOpenEditForm, navigateAfterEditSave, onBackToHotels]);

  function setSearchCheckIn(checkIn: string) {
    setSearchDates((dates) => ({
      checkIn,
      checkOut: dates.checkOut && dates.checkOut <= checkIn ? '' : dates.checkOut,
    }));
  }

  function submitHotelSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    actions.hotelList.setCityFilter(searchCity);
  }

  function handleBackToHotels() {
    if (!hasOpenEditForm) {
      onBackToHotels();
      return;
    }

    setShowEditExitGuard(true);
  }

  function saveEditBeforeBack() {
    const formId = model.showHotelForm ? 'hotel-edit-form' : 'room-edit-form';
    const form = document.getElementById(formId) as HTMLFormElement | null;

    setNavigateAfterEditSave(true);
    form?.requestSubmit();
  }

  function cancelEditAndGoBack() {
    if (model.showHotelForm) {
      actions.hotelForm.cancel();
    }

    if (model.showRoomForm) {
      actions.roomForm.cancel();
    }

    setShowEditExitGuard(false);
    onBackToHotels();
  }

  function renderHotelWorkspace() {
    return (
      <section className="container od-hotel-workspace">
        <div className="panel wide">
          {isHotelDetailPage && (
            <div className="hotel-back-area">
              <button className="hotel-back-button" onClick={handleBackToHotels} type="button" aria-label="Back to hotels">
                Back
              </button>
            </div>
          )}

          <div className="section-title">
            <h2>{model.showHotelForm ? (model.editingHotelId ? 'Edit hotel' : 'Create hotel') : model.selectedHotel?.name}</h2>
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
              <div className="hotel-detail-overview">
                <div className="hotel-image-frame">
                  <img
                    className="selected-hotel-image"
                    src={model.selectedHotel.imageUrl || fallbackImage(model.selectedHotel.name, 'hotel')}
                    alt=""
                  />
                </div>
                <div className="hotel-detail-copy">
                  <button className="btn btn-primary hotel-book-button" onClick={() => setShowRooms(true)} type="button">
                    Book
                  </button>
                </div>
              </div>

              {model.canManageHotels && (
                <>
                  {!model.showRoomForm && (
                    <div className="hotel-actions">
                      <button className="small-primary-button" onClick={() => actions.hotelForm.edit(model.selectedHotel!)} type="button">
                        Edit hotel
                      </button>
                      <button
                        className="small-primary-button"
                        onClick={() => {
                          setShowRooms(true);
                          actions.roomForm.startCreate();
                        }}
                        type="button"
                      >
                        Create room
                      </button>
                    </div>
                  )}

                </>
              )}

              {showRooms && (
                <>
                  <div className="hotel-rooms-band">
                    <div className="hotel-rooms-band-inner">
                      <RoomList
                        actions={actions.roomList}
                        canManageHotels={model.canManageHotels}
                        rooms={model.rooms}
                        roomsLoading={model.roomsLoading}
                        selectedRoom={model.selectedRoom}
                        submitting={submitting}
                      />
                    </div>
                  </div>

                  {model.showRoomForm && (
                    <RoomForm
                      actions={actions.roomForm}
                      editingRoomId={model.editingRoomId}
                      roomForm={model.roomForm}
                      submitting={submitting}
                    />
                  )}

                  {model.selectedRoom && (
                    <div className="hotel-room-booking-layout">
                      <div className="hotel-room-booking-media">
                        <RoomPhotoStrip room={model.selectedRoom} />
                      </div>

                      <div className="hotel-room-booking-panel">
                        <div className="hotel-booking-payment-row">
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
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {model.selectedHotel.description && (
                <section className="hotel-description-section" aria-label="Hotel description">
                  <h3>About this hotel</h3>
                  <p>{model.selectedHotel.description}</p>
                </section>
              )}
            </>
          ) : null}
        </div>
        {showEditExitGuard && hasOpenEditForm && (
          <div className="edit-exit-guard-backdrop" role="presentation">
            <div className="edit-exit-guard" role="dialog" aria-modal="true" aria-labelledby="edit-exit-title">
              <strong id="edit-exit-title">Finish editing first</strong>
              <span>Save your changes or cancel editing before going back.</span>
              <div>
                <button disabled={submitting} onClick={saveEditBeforeBack} type="button">
                  Save changes
                </button>
                <button disabled={submitting} onClick={cancelEditAndGoBack} type="button">
                  Cancel edit
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (isHotelDetailPage) {
    return (
      <section className="page od-hotels-page">
        {hotelDetailNotFound ? (
          <section className="container od-hotel-workspace">
            <div className="panel wide">
              <button className="hotel-back-button" onClick={onBackToHotels} type="button" aria-label="Back to hotels">
                Back
              </button>
              <div className="section-title">
                <h2>Hotel not found</h2>
              </div>
              <p className="empty">This hotel does not exist or is no longer available.</p>
            </div>
          </section>
        ) : hotelDetailLoading && !model.selectedHotel ? (
          <section className="container od-hotel-workspace">
            <div className="panel wide">
              <div className="section-title">
                <h2>Loading hotel...</h2>
              </div>
            </div>
          </section>
        ) : (
          renderHotelWorkspace()
        )}
        <SiteFooter onNavigate={onNavigate} onOpenAuth={onOpenAuth} onShowDestinations={onShowDestinations} />
      </section>
    );
  }

  return (
    <section className="page od-hotels-page">
      <section className="hotels-hero">
        <div className="container">
          <div className="page-head">
            <h1 className="page-title">Find your perfect stay</h1>
            <p className="page-sub">Discover hotels across Azerbaijan and choose the room that fits your trip.</p>
          </div>

          <form className="search-bar" onSubmit={submitHotelSearch}>
            <label className="field">
              City
              <div className="field-control has-select">
                <select value={searchCity} onChange={(event) => setSearchCity(event.target.value)}>
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
                <input
                  min={todayDate}
                  type="date"
                  value={searchDates.checkIn}
                  onChange={(event) => setSearchCheckIn(event.target.value)}
                />
              </div>
            </label>
            <label className="field">
              Check-out
              <div className="field-control">
                <input
                  min={minCheckOutDate}
                  type="date"
                  value={searchDates.checkOut}
                  onChange={(event) => setSearchDates({ ...searchDates, checkOut: event.target.value })}
                />
              </div>
            </label>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

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
        onOpenHotel={onOpenHotel}
      />

      {model.showHotelForm && renderHotelWorkspace()}
      <SiteFooter onNavigate={onNavigate} onOpenAuth={onOpenAuth} onShowDestinations={onShowDestinations} />
    </section>
  );
}
