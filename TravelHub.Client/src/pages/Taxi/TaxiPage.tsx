import type { FormEvent, MouseEvent, ReactNode } from 'react';
import { formatMoney, formatTaxiCarClassName } from '../../utils/formatting';
import { fallbackImage } from '../../utils/images';
import { taxiCarClassOptions } from '../../utils/taxi';
import type {
  AuthUser,
  Booking,
  BookingGuestMode,
  TaxiBooking,
  TaxiBookingForm,
  TaxiCarClass,
  TaxiCarClassForm,
  TaxiForm,
  TaxiPointMode,
  TaxiService,
} from '../../types';

type TaxiPageProps = {
  taxiServices: TaxiService[];
  selectedTaxiService: TaxiService | null;
  selectedTaxiCarClass: TaxiCarClass | null;
  taxiForm: TaxiForm;
  taxiBookingForm: TaxiBookingForm;
  taxiBooking: TaxiBooking | null;
  taxiPointMode: TaxiPointMode;
  taxiBookingGuestMode: BookingGuestMode;
  taxiDistanceKm: number;
  taxiEstimatedTotal: number;
  currentUser: AuthUser | null;
  loading: boolean;
  submitting: boolean;
  canManageTaxi: boolean;
  showTaxiForm: boolean;
  editingTaxiId: number | null;
  phoneNumberPattern: string;
  pricePattern: string;
  renderPaymentForm: (booking: Booking | TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onStartCreateTaxiService: () => void;
  onSelectTaxiService: (taxi: TaxiService) => void;
  onEditTaxiService: (taxi: TaxiService) => void;
  onDeleteTaxiService: (taxiServiceId: number) => void;
  onSubmitTaxiService: (event: FormEvent<HTMLFormElement>) => void;
  onTaxiFormChange: (form: TaxiForm) => void;
  onUpdateTaxiCity: (index: number, city: string) => void;
  onRemoveTaxiCity: (index: number) => void;
  onAddTaxiCity: () => void;
  onUpdateTaxiCarClass: (index: number, update: Partial<TaxiCarClassForm>) => void;
  onRemoveTaxiCarClass: (index: number) => void;
  onAddTaxiCarClass: () => void;
  onCancelTaxiForm: () => void;
  onTaxiBookingFormChange: (form: TaxiBookingForm) => void;
  onSelectTaxiBookingGuestMode: (mode: BookingGuestMode) => void;
  onSetTaxiPointMode: (mode: TaxiPointMode) => void;
  onUpdateTaxiMapPoint: (event: MouseEvent<HTMLButtonElement>) => void;
  onSubmitTaxiBooking: (event: FormEvent<HTMLFormElement>) => void;
  onOpenAuth: () => void;
  onResetTaxiBookingFlow: () => void;
};

export default function TaxiPage({
  taxiServices,
  selectedTaxiService,
  selectedTaxiCarClass,
  taxiForm,
  taxiBookingForm,
  taxiBooking,
  taxiPointMode,
  taxiBookingGuestMode,
  taxiDistanceKm,
  taxiEstimatedTotal,
  currentUser,
  loading,
  submitting,
  canManageTaxi,
  showTaxiForm,
  editingTaxiId,
  phoneNumberPattern,
  pricePattern,
  renderPaymentForm,
  onStartCreateTaxiService,
  onSelectTaxiService,
  onEditTaxiService,
  onDeleteTaxiService,
  onSubmitTaxiService,
  onTaxiFormChange,
  onUpdateTaxiCity,
  onRemoveTaxiCity,
  onAddTaxiCity,
  onUpdateTaxiCarClass,
  onRemoveTaxiCarClass,
  onAddTaxiCarClass,
  onCancelTaxiForm,
  onTaxiBookingFormChange,
  onSelectTaxiBookingGuestMode,
  onSetTaxiPointMode,
  onUpdateTaxiMapPoint,
  onSubmitTaxiBooking,
  onOpenAuth,
  onResetTaxiBookingFlow,
}: TaxiPageProps) {
  return (
    <section className="hotel-page taxi-page">
      <aside className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Taxi</p>
            <h2>Taxi booking</h2>
          </div>
          <span>{taxiServices.length} services</span>
        </div>

        {canManageTaxi && !showTaxiForm && (
          <button className="primary" onClick={onStartCreateTaxiService} type="button">
            Create taxi service
          </button>
        )}

        <div className="hotel-list">
          {taxiServices.map((taxi) => (
            <article className={`hotel-card ${selectedTaxiService?.id === taxi.id && !showTaxiForm ? 'active' : ''}`} key={taxi.id}>
              <button className="hotel-card-main" onClick={() => onSelectTaxiService(taxi)} type="button">
                <img src={taxi.imageUrl || fallbackImage(taxi.companyName, 'taxi')} alt="" />
                <span>
                  <strong>{taxi.companyName}</strong>
                  <small>{taxi.city}</small>
                  <span className="hotel-card-stats">
                    <small>{taxi.carClasses.length} classes</small>
                    <small>{taxi.phoneNumber}</small>
                  </span>
                </span>
              </button>
              {canManageTaxi && (
                <div className="card-actions">
                  <button disabled={submitting} onClick={() => onEditTaxiService(taxi)} type="button">
                    Edit
                  </button>
                  <button disabled={submitting} onClick={() => onDeleteTaxiService(taxi.id)} type="button">
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}

          {!loading && taxiServices.length === 0 && <p className="empty">No taxi services yet.</p>}
        </div>
      </aside>

      <section className="panel wide">
        <div className="section-title">
          <h2>{showTaxiForm ? (editingTaxiId ? 'Edit taxi service' : 'Create taxi service') : selectedTaxiService ? selectedTaxiService.companyName : 'Select a taxi service'}</h2>
          {!showTaxiForm && selectedTaxiService && <span>{selectedTaxiService.city}</span>}
        </div>

        {showTaxiForm && canManageTaxi ? (
          <form className="form-grid" onSubmit={(event) => void onSubmitTaxiService(event)}>
            <h3>{editingTaxiId ? 'Edit taxi service' : 'New taxi service'}</h3>
            <input
              placeholder="Company name"
              value={taxiForm.companyName}
              onChange={(event) => onTaxiFormChange({ ...taxiForm, companyName: event.target.value })}
              required
            />
            <div className="taxi-cities">
              <strong>Cities</strong>
              {taxiForm.cities.map((city, index) => (
                <div className="taxi-city-row" key={index}>
                  <input
                    placeholder="City"
                    value={city}
                    onChange={(event) => onUpdateTaxiCity(index, event.target.value)}
                    required
                  />
                  <button disabled={taxiForm.cities.length === 1} onClick={() => onRemoveTaxiCity(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              <button className="link-button" onClick={onAddTaxiCity} type="button">
                Add city
              </button>
            </div>
            <input
              inputMode="tel"
              pattern={phoneNumberPattern}
              placeholder="Phone number"
              title="Use digits, spaces, +, -, or parentheses."
              type="tel"
              value={taxiForm.phoneNumber}
              onChange={(event) => onTaxiFormChange({ ...taxiForm, phoneNumber: event.target.value })}
              required
            />
            <div className="taxi-classes">
              <strong>Car classes</strong>
              {taxiForm.carClasses.map((carClass, index) => (
                <div className="taxi-class-row" key={index}>
                  <select
                    value={carClass.name}
                    onChange={(event) => onUpdateTaxiCarClass(index, { name: event.target.value })}
                    required
                  >
                    {taxiCarClassOptions.map((option) => (
                      <option
                        disabled={taxiForm.carClasses.some(
                          (currentCarClass, currentIndex) =>
                            currentIndex !== index && currentCarClass.name === option.value,
                        )}
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="taxi-price-input"
                    inputMode="decimal"
                    min="0.01"
                    pattern={pricePattern}
                    placeholder="Price per km"
                    step="0.01"
                    title="Use a number greater than 0, for example 1.50."
                    type="text"
                    value={carClass.pricePerKm}
                    onChange={(event) => onUpdateTaxiCarClass(index, { pricePerKm: event.target.value })}
                    required
                  />
                  <button disabled={taxiForm.carClasses.length === 1} onClick={() => onRemoveTaxiCarClass(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="link-button"
                disabled={taxiForm.carClasses.length === taxiCarClassOptions.length}
                onClick={onAddTaxiCarClass}
                type="button"
              >
                Add class
              </button>
            </div>
            <input
              placeholder="Description"
              value={taxiForm.description}
              onChange={(event) => onTaxiFormChange({ ...taxiForm, description: event.target.value })}
              required
            />
            <input
              placeholder="Image URL"
              pattern="https?://.+"
              title="Use a full http or https URL."
              type="url"
              value={taxiForm.imageUrl || ''}
              onChange={(event) => onTaxiFormChange({ ...taxiForm, imageUrl: event.target.value })}
              required
            />
            <button className="primary" disabled={submitting} type="submit">
              {editingTaxiId ? 'Save taxi service' : 'Create taxi service'}
            </button>
            <button className="link-button" disabled={submitting} onClick={onCancelTaxiForm} type="button">
              Cancel
            </button>
          </form>
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
                <form className="form-grid taxi-order-form" onSubmit={(event) => void onSubmitTaxiBooking(event)}>
                  <label className="field-label">
                    Car class
                    <select
                      value={selectedTaxiCarClass?.name ?? taxiBookingForm.carClassName}
                      onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, carClassName: event.target.value })}
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
                      onClick={() => onSelectTaxiBookingGuestMode('self')}
                      type="button"
                    >
                      Order for myself
                    </button>
                    <button
                      className={taxiBookingGuestMode === 'other' ? 'active' : ''}
                      onClick={() => onSelectTaxiBookingGuestMode('other')}
                      type="button"
                    >
                      Order for someone else
                    </button>
                  </div>
                  <input
                    placeholder="Customer name"
                    value={taxiBookingForm.customerName}
                    onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, customerName: event.target.value })}
                    required
                  />
                  <input
                    pattern={phoneNumberPattern}
                    placeholder="Phone number"
                    type="tel"
                    value={taxiBookingForm.phoneNumber}
                    onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, phoneNumber: event.target.value })}
                    required
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={taxiBookingForm.email}
                    onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, email: event.target.value })}
                    required
                  />
                  <input
                    placeholder="Pickup address"
                    value={taxiBookingForm.pickupAddress}
                    onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, pickupAddress: event.target.value })}
                    required
                  />
                  <input
                    placeholder="Dropoff address"
                    value={taxiBookingForm.dropoffAddress}
                    onChange={(event) => onTaxiBookingFormChange({ ...taxiBookingForm, dropoffAddress: event.target.value })}
                    required
                  />

                  <div className="taxi-map-panel">
                    <div className="booking-mode taxi-point-mode">
                      <button
                        className={taxiPointMode === 'pickup' ? 'active' : ''}
                        onClick={() => onSetTaxiPointMode('pickup')}
                        type="button"
                      >
                        Pickup
                      </button>
                      <button
                        className={taxiPointMode === 'dropoff' ? 'active' : ''}
                        onClick={() => onSetTaxiPointMode('dropoff')}
                        type="button"
                      >
                        Dropoff
                      </button>
                    </div>
                    <button className="taxi-map" onClick={onUpdateTaxiMapPoint} type="button" aria-label="Demo taxi map">
                      <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <line
                          x1={taxiBookingForm.pickupX}
                          y1={taxiBookingForm.pickupY}
                          x2={taxiBookingForm.dropoffX}
                          y2={taxiBookingForm.dropoffY}
                        />
                      </svg>
                      <span
                        className="taxi-marker pickup"
                        style={{ left: `${taxiBookingForm.pickupX}%`, top: `${taxiBookingForm.pickupY}%` }}
                      >
                        P
                      </span>
                      <span
                        className="taxi-marker dropoff"
                        style={{ left: `${taxiBookingForm.dropoffX}%`, top: `${taxiBookingForm.dropoffY}%` }}
                      >
                        D
                      </span>
                    </button>
                  </div>

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

              {taxiBooking && (
                <div className="booking-box taxi-booking-box">
                  <div>
                    <h3>{taxiBooking.status}</h3>
                    <p>{taxiBooking.pickupAddress} to {taxiBooking.dropoffAddress}</p>
                    <p>{taxiBooking.distanceKm.toFixed(2)} km / {formatMoney(taxiBooking.totalPrice)} total</p>
                    {taxiBooking.savedCardLast4 && <p>Saved card: **** {taxiBooking.savedCardLast4}</p>}
                  </div>

                  {taxiBooking.status === 'PendingPayment' && renderPaymentForm(taxiBooking, 'taxi')}

                  {taxiBooking.status !== 'PendingPayment' && (
                    <button className="primary" onClick={onResetTaxiBookingFlow} type="button">
                      New taxi booking
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <p className="empty">Choose a taxi service to create an order.</p>
        )}
      </section>
    </section>
  );
}
