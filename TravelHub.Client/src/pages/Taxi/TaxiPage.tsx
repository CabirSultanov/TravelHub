import type { ReactNode } from 'react';
import TaxiBookingForm from '../../features/taxi/components/TaxiBookingForm';
import TaxiBookingResult from '../../features/taxi/components/TaxiBookingResult';
import TaxiServiceForm from '../../features/taxi/components/TaxiServiceForm';
import TaxiServiceList from '../../features/taxi/components/TaxiServiceList';
import type { AuthUser, Booking, TaxiBooking } from '../../types';
import { formatMoney, formatTaxiCarClassName } from '../../utils/formatting';
import { fallbackImage } from '../../utils/images';
import type { TaxiFeature } from '../../features/taxi/taxi.types';

type TaxiPageProps = {
  feature: TaxiFeature;
  currentUser: AuthUser | null;
  submitting: boolean;
  loading: boolean;
  phoneNumberPattern: string;
  pricePattern: string;
  renderPaymentForm: (booking: Booking | TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onOpenAuth: () => void;
};

export default function TaxiPage({
  feature,
  currentUser,
  submitting,
  loading,
  phoneNumberPattern,
  pricePattern,
  renderPaymentForm,
  onOpenAuth,
}: TaxiPageProps) {
  const { model, actions } = feature;
  const { selectedTaxiService, selectedTaxiCarClass } = model;

  return (
    <div className="page-shell od-taxi-page">
      <section className="taxi-hero">
        <div className="container taxi-layout">
          <div className="taxi-copy">
            <p className="eyebrow">TravelHub Taxi</p>
            <h1>Book rides with real route estimates</h1>
            <p>
              Choose pickup and dropoff points on the map, compare car classes, and see a clear estimate before you confirm
              your Azerbaijan transfer.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#taxi-booking">
                Start a ride
              </a>
              <a className="btn btn-ghost-dark" href="#taxi-benefits">
                Ride details
              </a>
            </div>
          </div>

          <div className="route-card od-route-preview">
            <div className="route-form">
              <h2>Plan your ride</h2>
              <div className="route-fields">
                <div className="route-field">
                  <span className="route-dot pickup" aria-hidden="true" />
                  <div>
                    <label>Pickup</label>
                    <strong>{model.taxiBookingForm.pickupAddress || 'Choose pickup on map'}</strong>
                  </div>
                </div>
                <div className="route-field">
                  <span className="route-dot dropoff" aria-hidden="true" />
                  <div>
                    <label>Dropoff</label>
                    <strong>{model.taxiBookingForm.dropoffAddress || 'Choose dropoff on map'}</strong>
                  </div>
                </div>
              </div>
              <div className="vehicle-row">
                {selectedTaxiService?.carClasses.slice(0, 3).map((carClass) => (
                  <button
                    className={`vehicle-option ${selectedTaxiCarClass?.id === carClass.id ? 'is-selected' : ''}`}
                    key={carClass.id}
                    onClick={() => actions.bookingForm.setForm({ ...model.taxiBookingForm, carClassName: carClass.name })}
                    type="button"
                  >
                    <strong>{formatTaxiCarClassName(carClass.name)}</strong>
                    <span>{formatMoney(carClass.pricePerKm)}/km</span>
                  </button>
                ))}
              </div>
              <a className="btn btn-primary btn-wide" href="#taxi-booking">
                Open booking map
              </a>
            </div>
            <div className="route-map">
              <div className="route-line" aria-hidden="true" />
              <div className="map-pin pickup">Pickup</div>
              <div className="map-pin dropoff">Dropoff</div>
              <div className="route-summary">
                <span>Estimated route</span>
                <strong>{model.taxiDistanceKm > 0 ? `${model.taxiDistanceKm.toFixed(2)} km` : 'Choose route'}</strong>
                <span>{model.taxiEstimatedTotal > 0 ? formatMoney(model.taxiEstimatedTotal) : 'Fare appears after route'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container od-taxi-workspace hotel-page taxi-page" id="taxi-booking">
        <TaxiServiceList
          actions={actions.service}
          canManageTaxi={model.canManageTaxi}
          loading={loading}
          selectedTaxiService={selectedTaxiService}
          showTaxiForm={model.showTaxiForm}
          submitting={submitting}
          taxiServices={model.taxiServices}
        />

        <section className="panel wide">
        <div className="section-title">
          <h2>{model.showTaxiForm ? (model.editingTaxiId ? 'Edit taxi service' : 'Create taxi service') : selectedTaxiService ? selectedTaxiService.companyName : 'Select a taxi service'}</h2>
          {!model.showTaxiForm && selectedTaxiService && <span>{selectedTaxiService.city}</span>}
        </div>

        {model.showTaxiForm && model.canManageTaxi ? (
          <TaxiServiceForm
            actions={actions.serviceForm}
            editingTaxiId={model.editingTaxiId}
            phoneNumberPattern={phoneNumberPattern}
            pricePattern={pricePattern}
            submitting={submitting}
            taxiForm={model.taxiForm}
          />
        ) : selectedTaxiService ? (
          <>
            <img
              className="selected-hotel-image"
              src={selectedTaxiService.imageUrl || fallbackImage(selectedTaxiService.companyName, 'taxi')}
              alt=""
            />
            <p className="description">{selectedTaxiService.description}</p>
            <div className="tariff-list taxi-detail-tariffs">
              {selectedTaxiService.carClasses.map((carClass) => (
                <small key={carClass.id}>
                  {formatTaxiCarClassName(carClass.name)}: {formatMoney(carClass.pricePerKm)}/km
                </small>
              ))}
            </div>
            <TaxiBookingForm
              actions={actions.bookingForm}
              currentUser={currentUser}
              phoneNumberPattern={phoneNumberPattern}
              selectedTaxiCarClass={selectedTaxiCarClass}
              selectedTaxiService={selectedTaxiService}
              submitting={submitting}
              taxiBookingForm={model.taxiBookingForm}
              taxiBookingGuestMode={model.taxiBookingGuestMode}
              taxiCoordinates={model.taxiCoordinates}
              taxiDistanceKm={model.taxiDistanceKm}
              taxiEstimatedTotal={model.taxiEstimatedTotal}
              taxiPointMode={model.taxiPointMode}
              taxiRouteState={model.taxiRouteState}
              onOpenAuth={onOpenAuth}
            >
              <TaxiBookingResult
                booking={model.taxiBooking}
                onReset={actions.resetBooking}
                renderPaymentForm={renderPaymentForm}
              />
            </TaxiBookingForm>
          </>
        ) : (
          <p className="empty">Choose a taxi service to create an order.</p>
        )}
        </section>
      </section>

      <section className="taxi-band" id="taxi-benefits">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Built for city and airport transfers</p>
              <h2>Clear details before every ride</h2>
            </div>
            <p>Compact controls, realistic fare states, and a route-first map make taxi booking feel connected to TravelHub.</p>
          </div>
          <div className="fare-grid">
            <article className="fare-card">
              <h3>Route based</h3>
              <p>Distance and time are tied to the actual road route.</p>
            </article>
            <article className="fare-card">
              <h3>Car classes</h3>
              <p>Compare comfort, business, and group options quickly.</p>
            </article>
            <article className="fare-card">
              <h3>Secure payment</h3>
              <p>Pay online or keep the ride ready for confirmation.</p>
            </article>
            <article className="fare-card">
              <h3>Trip history</h3>
              <p>Airport pickups and repeat routes stay easy to manage.</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
