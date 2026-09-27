import type { FormEvent, ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import TaxiMap from './TaxiMap';
import PaymentMethodFields from '../../../components/booking/PaymentMethodFields';
import { formatMoney, formatTaxiCarClassName } from '../../../utils/formatting';
import type { AuthUser, BookingPayment, PaymentForm, PaymentMode, SavedPaymentCard, TaxiCarClass, TaxiService } from '../../../types';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../googleMapsConfig';
import { canCreateTaxiBooking } from '../taxi.state';
import type {
  TaxiBookingForm as TaxiBookingFormState,
  TaxiBookingFormActions,
  TaxiCoordinates,
  TaxiPointMode,
  TaxiRouteState,
} from '../taxi.types';

type TaxiBookingFormProps = {
  selectedTaxiService: TaxiService;
  selectedTaxiCarClass: TaxiCarClass | null;
  taxiBookingForm: TaxiBookingFormState;
  taxiPointMode: TaxiPointMode;
  taxiBookingGuestMode: 'self' | 'other';
  taxiDistanceKm: number;
  taxiEstimatedTotal: number;
  taxiCoordinates: TaxiCoordinates;
  taxiRouteState: TaxiRouteState;
  currentUser: AuthUser | null;
  submitting: boolean;
  phoneNumberPattern: string;
  cardNumberPattern: string;
  cvvPattern: string;
  currentYear: number;
  paymentMode: PaymentMode;
  paymentForm: PaymentForm;
  savedPaymentCards: SavedPaymentCard[];
  onPaymentModeChange: (mode: PaymentMode) => void;
  onPaymentFormChange: (form: PaymentForm) => void;
  actions: TaxiBookingFormActions;
  onOpenAuth: () => void;
  children?: ReactNode;
};

export default function TaxiBookingForm({
  selectedTaxiService,
  selectedTaxiCarClass,
  taxiBookingForm,
  taxiPointMode,
  taxiBookingGuestMode,
  taxiDistanceKm,
  taxiEstimatedTotal,
  taxiCoordinates,
  taxiRouteState,
  currentUser,
  submitting,
  phoneNumberPattern,
  cardNumberPattern,
  cvvPattern,
  currentYear,
  paymentMode,
  paymentForm,
  savedPaymentCards,
  onPaymentModeChange,
  onPaymentFormChange,
  actions,
  onOpenAuth,
  children,
}: TaxiBookingFormProps) {
  const canCreateBooking = canCreateTaxiBooking(
    taxiBookingForm,
    taxiCoordinates,
    taxiRouteState,
    selectedTaxiCarClass?.pricePerKm,
  );
  const distanceLabel =
    taxiRouteState.status === 'loading' ? 'Calculating...' : taxiDistanceKm > 0 ? `${taxiDistanceKm.toFixed(2)} km` : '-';
  const payment: BookingPayment = paymentMode === 'saved' && savedPaymentCards.length > 0
    ? { savedPaymentCardId: Number(paymentForm.savedPaymentCardId), saveCard: false }
    : {
        cardNumber: paymentForm.cardNumber,
        cardHolderName: paymentForm.cardHolderName,
        expiryMonth: Number(paymentForm.expiryMonth),
        expiryYear: Number(paymentForm.expiryYear),
        cvv: paymentForm.cvv,
        saveCard: paymentForm.saveCard,
      };

  return (
    <section className="taxi-order">
      {!currentUser ? (
        <div className="form-grid">
          <p className="empty">Please register or sign in to order a taxi.</p>
          <button className="primary" onClick={onOpenAuth} type="button">
            Register to order
          </button>
        </div>
      ) : (
        <form className="form-grid taxi-order-form" onSubmit={(event: FormEvent<HTMLFormElement>) => void actions.submit(event, payment)}>
          <label className="field-label">
            Car class
            <select
              value={selectedTaxiCarClass?.name ?? taxiBookingForm.carClassName}
              onChange={(event) => actions.setForm({ ...taxiBookingForm, carClassName: event.target.value })}
              required
            >
              {selectedTaxiService.carClasses.map((carClass) => (
                <option key={carClass.id} value={carClass.name}>
                  {formatTaxiCarClassName(carClass.name)}
                </option>
              ))}
            </select>
          </label>
          <div className="booking-mode">
            <button
              className={taxiBookingGuestMode === 'self' ? 'active' : ''}
              onClick={() => actions.selectGuestMode('self')}
              type="button"
            >
              Order for myself
            </button>
            <button
              className={taxiBookingGuestMode === 'other' ? 'active' : ''}
              onClick={() => actions.selectGuestMode('other')}
              type="button"
            >
              Order for someone else
            </button>
          </div>
          <input
            placeholder="Customer name"
            value={taxiBookingForm.customerName}
            onChange={(event) => actions.setForm({ ...taxiBookingForm, customerName: event.target.value })}
            required
          />
          <input
            pattern={phoneNumberPattern}
            placeholder="Phone number"
            type="tel"
            value={taxiBookingForm.phoneNumber}
            onChange={(event) => actions.setForm({ ...taxiBookingForm, phoneNumber: event.target.value })}
            required
          />
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES} authReferrerPolicy="origin">
              <TaxiMap
                dropoff={taxiCoordinates.dropoff}
                mode={taxiPointMode}
                onModeChange={actions.setPointMode}
                onPointAddressChange={actions.updatePointAddress}
                onPointChange={actions.updatePoint}
                onRouteChange={actions.setRoute}
                pickup={taxiCoordinates.pickup}
              />
            </APIProvider>
          ) : (
            <div className="taxi-map-panel">
              <p className="taxi-map-instructions">Google Maps API key is not configured.</p>
              <div className="taxi-map" />
            </div>
          )}

          <div className="taxi-estimate">
            <span>
              <strong>{distanceLabel}</strong>
              <small>Distance</small>
            </span>
            <span>
              <strong>{selectedTaxiCarClass ? formatMoney(selectedTaxiCarClass.pricePerKm) : '-'}</strong>
              <small>Price per km</small>
            </span>
            <span>
              <strong>{formatMoney(taxiEstimatedTotal)}</strong>
              <small>Total estimate</small>
            </span>
          </div>

          <fieldset className="payment-method-section">
            <legend>Payment method</legend>
            <p>Your card is charged only after a driver accepts this ride.</p>
            <PaymentMethodFields
              cardNumberPattern={cardNumberPattern}
              currentYear={currentYear}
              cvvPattern={cvvPattern}
              onPaymentFormChange={onPaymentFormChange}
              onPaymentModeChange={onPaymentModeChange}
              paymentForm={paymentForm}
              paymentMode={paymentMode}
              savedPaymentCards={savedPaymentCards}
            />
          </fieldset>

          <button className="primary" disabled={submitting || !canCreateBooking} type="submit">
            Request ride
          </button>
        </form>
      )}

      {children}
    </section>
  );
}
