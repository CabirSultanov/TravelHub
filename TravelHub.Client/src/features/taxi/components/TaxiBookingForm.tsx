import type { FormEvent, ReactNode } from 'react';
import TaxiMap from './TaxiMap';
import { formatMoney, formatTaxiCarClassName } from '../../../utils/formatting';
import type { AuthUser, TaxiCarClass, TaxiService } from '../../../types';
import type { TaxiBookingForm as TaxiBookingFormState, TaxiBookingFormActions, TaxiPointMode } from '../taxi.types';

type TaxiBookingFormProps = {
  selectedTaxiService: TaxiService;
  selectedTaxiCarClass: TaxiCarClass | null;
  taxiBookingForm: TaxiBookingFormState;
  taxiPointMode: TaxiPointMode;
  taxiBookingGuestMode: 'self' | 'other';
  taxiDistanceKm: number;
  taxiEstimatedTotal: number;
  currentUser: AuthUser | null;
  submitting: boolean;
  phoneNumberPattern: string;
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
  currentUser,
  submitting,
  phoneNumberPattern,
  actions,
  onOpenAuth,
  children,
}: TaxiBookingFormProps) {
  return (
    <section className="taxi-order">
      <div className="section-title">
        <h3>Order a taxi</h3>
        <span>{selectedTaxiCarClass ? `${formatMoney(selectedTaxiCarClass.pricePerKm)}/km` : 'Choose class'}</span>
      </div>

      {!currentUser ? (
        <div className="form-grid">
          <p className="empty">Please register or sign in to order a taxi.</p>
          <button className="primary" onClick={onOpenAuth} type="button">
            Register to order
          </button>
        </div>
      ) : (
        <form className="form-grid taxi-order-form" onSubmit={(event: FormEvent<HTMLFormElement>) => void actions.submit(event)}>
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
          <input
            placeholder="Email"
            type="email"
            value={taxiBookingForm.email}
            onChange={(event) => actions.setForm({ ...taxiBookingForm, email: event.target.value })}
            required
          />
          <input
            placeholder="Pickup address"
            value={taxiBookingForm.pickupAddress}
            onChange={(event) => actions.setForm({ ...taxiBookingForm, pickupAddress: event.target.value })}
            required
          />
          <input
            placeholder="Dropoff address"
            value={taxiBookingForm.dropoffAddress}
            onChange={(event) => actions.setForm({ ...taxiBookingForm, dropoffAddress: event.target.value })}
            required
          />

          <TaxiMap
            dropoff={{ x: taxiBookingForm.dropoffX, y: taxiBookingForm.dropoffY }}
            mode={taxiPointMode}
            onModeChange={actions.setPointMode}
            onPointChange={actions.updatePoint}
            pickup={{ x: taxiBookingForm.pickupX, y: taxiBookingForm.pickupY }}
          />

          <div className="taxi-estimate">
            <span>
              <strong>{taxiDistanceKm.toFixed(2)} km</strong>
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

          <button className="primary" disabled={submitting || !selectedTaxiCarClass} type="submit">
            Create taxi booking
          </button>
        </form>
      )}

      {children}
    </section>
  );
}
