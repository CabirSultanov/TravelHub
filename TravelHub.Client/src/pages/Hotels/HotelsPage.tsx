import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import HotelBookingForm from '../../features/hotels/components/HotelBookingForm';
import HotelBookingResult from '../../features/hotels/components/HotelBookingResult';
import HotelForm from '../../features/hotels/components/HotelForm';
import HotelList from '../../features/hotels/components/HotelList';
import HotelReviews from '../../features/hotels/components/HotelReviews';
import RoomForm from '../../features/hotels/components/RoomForm';
import RoomList, { RoomPhotoStrip } from '../../features/hotels/components/RoomList';
import ImageCarousel from '../../components/common/ImageCarousel';
import SiteFooter from '../../components/common/SiteFooter';
import type { AuthUser, Booking, Hotel, Page, TaxiBooking } from '../../types';
import {
  clearInvalidHotelCheckOut,
  hotelDateRangeErrorMessage,
  isHotelDateRangeValid,
  minHotelCheckOutDate,
  todayDateInputValue,
} from '../../utils/dateRange';
import { hotelImageUrls, hotelMainImage } from '../../utils/images';
import type { HotelRouteSearch } from '../../utils/routing';
import type { HotelsFeature } from '../../features/hotels/hotels.types';
import { useHotelReviews } from '../../features/hotels/hooks/useHotelReviews';

type HotelsPageProps = {
  feature: HotelsFeature;
  currentUser: AuthUser | null;
  submitting: boolean;
  loading: boolean;
  phoneNumberPattern: string;
  renderPaymentForm: (booking: Booking | TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onOpenAuth: () => void;
  onRequireAuth: (message: string) => void;
  setMessage: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  hotelDetailId: number | null;
  hotelDetailLoading: boolean;
  hotelDetailNotFound: boolean;
  blockedBackSignal: number;
  onBackToHotels: () => void;
  onNavigate: (page: Page) => void;
  onOpenHotel: (hotel: Hotel) => void;
  onRoomSelect: (roomId: number) => void;
  onSearchHotels: (search: Partial<HotelRouteSearch>) => void;
  onShowDestinations: () => void;
  requestedRoomId: number | null;
  search: HotelRouteSearch;
};

export default function HotelsPage({
  feature,
  currentUser,
  submitting,
  loading,
  phoneNumberPattern,
  renderPaymentForm,
  onOpenAuth,
  onRequireAuth,
  setMessage,
  setSubmitting,
  hotelDetailId,
  hotelDetailLoading,
  hotelDetailNotFound,
  blockedBackSignal,
  onBackToHotels,
  onNavigate,
  onOpenHotel,
  onRoomSelect,
  onSearchHotels,
  onShowDestinations,
  requestedRoomId,
  search,
}: HotelsPageProps) {
  const { model, actions } = feature;
  const isHotelDetailPage = hotelDetailId !== null;
  const [showRooms, setShowRooms] = useState(false);
  const [searchCity, setSearchCity] = useState(model.cityFilter);
  const [searchDates, setSearchDates] = useState({ checkIn: '', checkOut: '' });
  const [searchError, setSearchError] = useState('');
  const [showEditExitGuard, setShowEditExitGuard] = useState(false);
  const [navigateAfterEditSave, setNavigateAfterEditSave] = useState(false);
  const todayDate = todayDateInputValue();
  const minCheckOutDate = minHotelCheckOutDate(searchDates.checkIn || todayDate);
  const hasOpenEditForm = model.showHotelForm || model.showRoomForm;
  const reviewsFeature = useHotelReviews({
    hotelId: isHotelDetailPage ? hotelDetailId : null,
    currentUser,
    onRequireAuth,
    onStatsChange: actions.hotelList.updateStats,
    setMessage,
    setSubmitting,
  });

  useEffect(() => {
    setShowRooms(false);
  }, [hotelDetailId]);

  useEffect(() => {
    setSearchCity(search.city);
    setSearchDates({ checkIn: search.checkIn, checkOut: search.checkOut });
  }, [search.checkIn, search.checkOut, search.city]);

  useEffect(() => {
    if (!requestedRoomId || !isHotelDetailPage || model.roomsLoading) {
      return;
    }

    const requestedRoom = model.rooms.find((room) => room.id === requestedRoomId);

    if (requestedRoom) {
      setShowRooms(true);
    }
  }, [isHotelDetailPage, model.rooms, model.roomsLoading, requestedRoomId]);

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
      checkOut: clearInvalidHotelCheckOut(checkIn, dates.checkOut),
    }));
    setSearchError('');
  }

  function submitHotelSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      (searchDates.checkIn && searchDates.checkIn < todayDate) ||
      (searchDates.checkIn && searchDates.checkOut && !isHotelDateRangeValid(searchDates.checkIn, searchDates.checkOut))
    ) {
      setSearchError(hotelDateRangeErrorMessage);
      return;
    }

    setSearchError('');
    onSearchHotels({ city: searchCity, checkIn: searchDates.checkIn, checkOut: searchDates.checkOut });
  }

  function changeHotelPage(page: number) {
    onSearchHotels({ ...search, page });
    window.requestAnimationFrame(() => {
      document.querySelector('.od-results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

  const roomListActions = {
    ...actions.roomList,
    select: (room: Parameters<typeof actions.roomList.select>[0]) => {
      actions.roomList.select(room);
      onRoomSelect(room.id);
    },
  };

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
                  <ImageCarousel
                    className="selected-hotel-image"
                    images={hotelImageUrls(model.selectedHotel)}
                    fallbackSrc={hotelMainImage(model.selectedHotel)}
                    alt={model.selectedHotel.name}
                  />
                </div>
                <div className="hotel-detail-copy">
                  {model.selectedHotel.description && <p className="description">{model.selectedHotel.description}</p>}
                  <button className="btn btn-primary hotel-book-button" onClick={() => setShowRooms(true)} type="button">
                    Book
                  </button>
                </div>
              </div>

              <HotelReviews currentUser={currentUser} feature={reviewsFeature} submitting={submitting} />

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
                        actions={roomListActions}
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
                  onChange={(event) => {
                    setSearchDates({ ...searchDates, checkOut: event.target.value });
                    setSearchError('');
                  }}
                />
              </div>
            </label>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>
          {searchError && (
            <p className="hotel-search-error" role="alert">
              {searchError}
            </p>
          )}

        </div>
      </section>

      <HotelList
        actions={actions.hotelList}
        canManageHotels={model.canManageHotels}
        cityFilter={model.cityFilter}
        hotelPage={model.hotelPage}
        hotelTotalItems={model.hotelTotalItems}
        hotelTotalPages={model.hotelTotalPages}
        hotels={model.hotels}
        loading={loading}
        selectedHotel={model.selectedHotel}
        showHotelForm={model.showHotelForm}
        submitting={submitting}
        onOpenHotel={onOpenHotel}
        onPageChange={changeHotelPage}
      />

      {model.showHotelForm && renderHotelWorkspace()}
      <SiteFooter onNavigate={onNavigate} onOpenAuth={onOpenAuth} onShowDestinations={onShowDestinations} />
    </section>
  );
}
