import TaxiBookingForm from '../../features/taxi/components/TaxiBookingForm';
import TaxiBookingResult from '../../features/taxi/components/TaxiBookingResult';
import TaxiServiceForm from '../../features/taxi/components/TaxiServiceForm';
import TaxiServiceList from '../../features/taxi/components/TaxiServiceList';
import TaxiDriversPanel from '../../features/taxi/components/TaxiDriversPanel';
import SiteFooter from '../../components/common/SiteFooter';
import type { AuthUser, Page, PaymentForm, PaymentMode, SavedPaymentCard, TaxiBooking } from '../../types';
import type { TaxiFeature } from '../../features/taxi/taxi.types';

type TaxiPageProps = {
  feature: TaxiFeature;
  currentUser: AuthUser | null;
  submitting: boolean;
  loading: boolean;
  phoneNumberPattern: string;
  pricePattern: string;
  paymentMode: PaymentMode;
  paymentForm: PaymentForm;
  savedPaymentCards: SavedPaymentCard[];
  cardNumberPattern: string;
  cvvPattern: string;
  currentYear: number;
  onPaymentModeChange: (mode: PaymentMode) => void;
  onPaymentFormChange: (form: PaymentForm) => void;
  onCancelTaxiBooking: (booking: TaxiBooking) => void | Promise<void>;
  onNavigate: (page: Page) => void;
  onOpenAuth: () => void;
  onShowDestinations: () => void;
  onTaxiRouteChange: (search: { serviceId: number; carClassName?: string }) => void;
};

export default function TaxiPage({
  feature,
  currentUser,
  submitting,
  loading,
  phoneNumberPattern,
  pricePattern,
  paymentMode,
  paymentForm,
  savedPaymentCards,
  cardNumberPattern,
  cvvPattern,
  currentYear,
  onPaymentModeChange,
  onPaymentFormChange,
  onCancelTaxiBooking,
  onNavigate,
  onOpenAuth,
  onShowDestinations,
  onTaxiRouteChange,
}: TaxiPageProps) {
  const { model, actions } = feature;
  const { selectedTaxiService, selectedTaxiCarClass } = model;
  const serviceActions = {
    ...actions.service,
    select: (taxiService: Parameters<typeof actions.service.select>[0]) => {
      actions.service.select(taxiService);
      onTaxiRouteChange({ serviceId: taxiService.id, carClassName: taxiService.carClasses[0]?.name ?? '' });
    },
  };
  const bookingFormActions = {
    ...actions.bookingForm,
    setForm: (form: Parameters<typeof actions.bookingForm.setForm>[0]) => {
      actions.bookingForm.setForm(form);

      if (selectedTaxiService && form.carClassName !== model.taxiBookingForm.carClassName) {
        onTaxiRouteChange({ serviceId: selectedTaxiService.id, carClassName: form.carClassName });
      }
    },
  };

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
          </div>
        </div>
      </section>

      <section className="container od-taxi-workspace hotel-page taxi-page" id="taxi-booking">
        <div className="taxi-sidebar-column">
          <TaxiServiceList
            actions={serviceActions}
            canEditTaxiService={model.canEditTaxiService}
            canManageTaxi={model.canManageTaxi}
            loading={loading}
            selectedTaxiService={selectedTaxiService}
            showTaxiForm={model.showTaxiForm}
            submitting={submitting}
            taxiServices={model.taxiServices}
          />

          {model.taxiBooking && (
            <section className="taxi-payment-slot" aria-label="Taxi payment">
              <TaxiBookingResult
                booking={model.taxiBooking}
                onCancel={() => void onCancelTaxiBooking(model.taxiBooking!)}
                onReset={actions.resetBooking}
              />
            </section>
          )}
        </div>

        <section className="panel wide taxi-detail-panel">
        <div className="section-title">
          <h2>{model.showTaxiForm ? (model.editingTaxiId ? 'Edit taxi service' : 'Create taxi service') : selectedTaxiService ? selectedTaxiService.companyName : 'Select a taxi service'}</h2>
          {!model.showTaxiForm && selectedTaxiService && <span>{selectedTaxiService.city}</span>}
        </div>

        {model.showTaxiForm && (model.editingTaxiId === null ? model.canManageTaxi : model.canManageSelectedTaxi) ? (
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
            <TaxiBookingForm
              actions={bookingFormActions}
              cardNumberPattern={cardNumberPattern}
              currentYear={currentYear}
              currentUser={currentUser}
              cvvPattern={cvvPattern}
              onPaymentFormChange={onPaymentFormChange}
              onPaymentModeChange={onPaymentModeChange}
              paymentForm={paymentForm}
              paymentMode={paymentMode}
              phoneNumberPattern={phoneNumberPattern}
              selectedTaxiCarClass={selectedTaxiCarClass}
              selectedTaxiService={selectedTaxiService}
              savedPaymentCards={savedPaymentCards}
              submitting={submitting}
              taxiBookingForm={model.taxiBookingForm}
              taxiBookingGuestMode={model.taxiBookingGuestMode}
              taxiCoordinates={model.taxiCoordinates}
              taxiDistanceKm={model.taxiDistanceKm}
              taxiEstimatedTotal={model.taxiEstimatedTotal}
              taxiPointMode={model.taxiPointMode}
              taxiRouteState={model.taxiRouteState}
              onOpenAuth={onOpenAuth}
            />
          </>
        ) : (
          <p className="empty">Choose a taxi service to create an order.</p>
        )}
        </section>

      </section>

      {!model.showTaxiForm && selectedTaxiService && model.canManageSelectedTaxi && currentUser?.role === 'TaxiOwner' && (
        <section className="container taxi-drivers-workspace" aria-label="Driver management">
          <div className="panel wide taxi-drivers-card">
            <TaxiDriversPanel management={model.taxiDrivers} submitting={submitting} />
          </div>
        </section>
      )}

      <SiteFooter onNavigate={onNavigate} onOpenAuth={onOpenAuth} onShowDestinations={onShowDestinations} />
    </div>
  );
}
