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
    <section className="hotel-page taxi-page">
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
  );
}
