import { useState, type FormEvent, type ReactNode } from 'react';
import type {
  AuthUser,
  Booking,
  BookingStatus,
  PaymentCardForm,
  ProfileForm,
  SavedPaymentCard,
  TaxiBooking,
} from '../../types';
import { getPasswordRequirements } from '../../utils/authValidation';
import { formatMoney } from '../../utils/formatting';

type ProfilePageProps = {
  currentUser: AuthUser;
  bookings: Booking[];
  taxiBookings: TaxiBooking[];
  savedPaymentCards: SavedPaymentCard[];
  bookingsLoading: boolean;
  taxiBookingsLoading: boolean;
  submitting: boolean;
  editingProfile: boolean;
  profileForm: ProfileForm;
  paymentCardForm: PaymentCardForm;
  showPaymentCardForm: boolean;
  payingBookingId: number | null;
  payingTaxiBookingId: number | null;
  accountPhonePrefix: string;
  accountPhonePattern: string;
  cardNumberPattern: string;
  cvvPattern: string;
  currentYear: number;
  formatTaxiCarClassName: (name: string) => string;
  renderPaymentForm: (booking: Booking | TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onProfileFormChange: (form: ProfileForm) => void;
  onSubmitProfile: (event: FormEvent<HTMLFormElement>) => void;
  onCancelProfileEdit: () => void;
  onOpenProfileEditor: () => void;
  onDeleteProfile: () => void | Promise<void>;
  onPaymentCardFormChange: (form: PaymentCardForm) => void;
  onSubmitPaymentCard: (event: FormEvent<HTMLFormElement>) => void;
  onCancelPaymentCardForm: () => void;
  onShowPaymentCardForm: (show: boolean) => void;
  onDeletePaymentCard: (cardId: number) => void | Promise<void>;
  onOpenPaymentForm: (bookingId: number) => void;
  onCancelBooking: (booking: Booking) => void | Promise<void>;
  onOpenTaxiPaymentForm: (bookingId: number) => void;
  onCancelTaxiBooking: (booking: TaxiBooking) => void | Promise<void>;
};

function formatProfilePaymentStatus(status: BookingStatus) {
  if (status === 'PendingPayment') {
    return 'Not paid';
  }

  return status;
}

type PasswordInputProps = {
  autoComplete: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  placeholder: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function PasswordInput({
  autoComplete,
  label,
  maxLength,
  minLength,
  placeholder,
  value,
  visible,
  onChange,
  onToggle,
}: PasswordInputProps) {
  return (
    <div className="password-field">
      <input
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        className="password-toggle"
        onClick={onToggle}
        title={visible ? `Hide ${label}` : `Show ${label}`}
        type="button"
      >
        <span className={`auth-password-eye ${visible ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ProfilePage({
  currentUser,
  bookings,
  taxiBookings,
  savedPaymentCards,
  bookingsLoading,
  taxiBookingsLoading,
  submitting,
  editingProfile,
  profileForm,
  paymentCardForm,
  showPaymentCardForm,
  accountPhonePrefix,
  accountPhonePattern,
  cardNumberPattern,
  cvvPattern,
  currentYear,
  formatTaxiCarClassName,
  onProfileFormChange,
  onSubmitProfile,
  onCancelProfileEdit,
  onOpenProfileEditor,
  onDeleteProfile,
  onPaymentCardFormChange,
  onSubmitPaymentCard,
  onCancelPaymentCardForm,
  onShowPaymentCardForm,
  onDeletePaymentCard,
}: ProfilePageProps) {
  const newPasswordRequirements = getPasswordRequirements(profileForm.newPassword);
  const [visiblePasswords, setVisiblePasswords] = useState({
    next: false,
    confirm: false,
  });

  function togglePasswordVisibility(field: keyof typeof visiblePasswords) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  }

  function cancelPasswordChange() {
    onProfileFormChange({
      ...profileForm,
      changePassword: false,
      newPassword: '',
      confirmNewPassword: '',
    });
    setVisiblePasswords({ next: false, confirm: false });
  }

  return (
    <div className="page-shell profile-page">
      <main>
    <section className="container od-profile-live">
      <div className="profile-layout">
        <div className="auth-panel">
          {editingProfile ? (
            <form className="auth-form" onSubmit={onSubmitProfile}>
              <label className="field-box">
                <span>Name</span>
                <input
                  placeholder="Name"
                  value={profileForm.name}
                  onChange={(event) => onProfileFormChange({ ...profileForm, name: event.target.value })}
                  required
                />
              </label>
              <label className="field-box">
                <span>Email</span>
                <input
                  placeholder="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => onProfileFormChange({ ...profileForm, email: event.target.value })}
                  required
                />
              </label>
              <label className="field-box">
                <span>Phone</span>
                <div className="phone-field">
                  <span>{accountPhonePrefix}</span>
                  <input
                    pattern={accountPhonePattern}
                    placeholder="Phone number"
                    type="tel"
                    value={profileForm.phoneNumber}
                    onChange={(event) => onProfileFormChange({ ...profileForm, phoneNumber: event.target.value })}
                    required
                  />
                </div>
              </label>

              {profileForm.changePassword ? (
                <section className="profile-password-section">
                  <div className="profile-password-heading">
                    <h3>Change password</h3>
                    <button className="link-button" onClick={cancelPasswordChange} type="button">
                      Cancel password change
                    </button>
                  </div>

                  <PasswordInput
                    autoComplete="new-password"
                    label="new password"
                    maxLength={128}
                    minLength={8}
                    placeholder="New password"
                    visible={visiblePasswords.next}
                    value={profileForm.newPassword}
                    onChange={(value) => onProfileFormChange({ ...profileForm, newPassword: value })}
                    onToggle={() => togglePasswordVisibility('next')}
                  />
                  <div className="password-requirements">
                    <strong>Password requirements</strong>
                    <ul>
                      {newPasswordRequirements.map((requirement) => (
                        <li className={requirement.valid ? 'is-valid' : 'is-invalid'} key={requirement.label}>
                          <span aria-hidden="true">{requirement.valid ? '✓' : '✗'}</span>
                          {requirement.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <PasswordInput
                    autoComplete="new-password"
                    label="confirm new password"
                    placeholder="Confirm new password"
                    visible={visiblePasswords.confirm}
                    value={profileForm.confirmNewPassword}
                    onChange={(value) => onProfileFormChange({ ...profileForm, confirmNewPassword: value })}
                    onToggle={() => togglePasswordVisibility('confirm')}
                  />
                </section>
              ) : (
                <button
                  className="profile-change-password-button link-button"
                  onClick={() => onProfileFormChange({ ...profileForm, changePassword: true })}
                  type="button"
                >
                  Change password
                </button>
              )}

              <div className="profile-edit-actions">
                <button className="primary" disabled={submitting} type="submit">
                  Save profile
                </button>
                <button className="link-button" onClick={onCancelProfileEdit} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-info">
              <span>
                <strong>Name</strong>
                {currentUser.name}
              </span>
              <span>
                <strong>Email</strong>
                {currentUser.email}
              </span>
              <span>
                <strong>Phone</strong>
                {currentUser.phoneNumber || 'Not set'}
              </span>
              <span>
                <strong>Role</strong>
                {currentUser.role}
              </span>
              <button className="primary" disabled={submitting} onClick={onOpenProfileEditor} type="button">
                Edit profile
              </button>
              {currentUser.role !== 'SuperAdmin' && (
                <button className="danger-button" disabled={submitting} onClick={() => void onDeleteProfile()} type="button">
                  Delete profile
                </button>
              )}
            </div>
          )}

          <section className="saved-cards">
            <div className="section-title">
              <h3>Saved cards</h3>
              <span>{savedPaymentCards.length}</span>
            </div>

            <div className="saved-card-list">
              {savedPaymentCards.map((card) => (
                <article className="saved-card" key={card.id}>
                  <span>
                    <strong>{card.brand} **** {card.last4}</strong>
                    <small>
                      {card.cardHolderName} / {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                    </small>
                  </span>
                  <button disabled={submitting} onClick={() => void onDeletePaymentCard(card.id)} type="button">
                    Delete
                  </button>
                </article>
              ))}

              {savedPaymentCards.length === 0 && <p className="empty">No saved cards yet.</p>}
            </div>

            {showPaymentCardForm ? (
              <form className="payment-card-form" onSubmit={onSubmitPaymentCard}>
                <input
                  inputMode="numeric"
                  pattern={cardNumberPattern}
                  placeholder="Card number"
                  value={paymentCardForm.cardNumber}
                  onChange={(event) => onPaymentCardFormChange({ ...paymentCardForm, cardNumber: event.target.value })}
                  required
                />
                <input
                  placeholder="Card holder"
                  value={paymentCardForm.cardHolderName}
                  onChange={(event) => onPaymentCardFormChange({ ...paymentCardForm, cardHolderName: event.target.value })}
                  required
                />
                <input
                  max="12"
                  min="1"
                  placeholder="Month"
                  type="number"
                  value={paymentCardForm.expiryMonth}
                  onChange={(event) => onPaymentCardFormChange({ ...paymentCardForm, expiryMonth: event.target.value })}
                  required
                />
                <input
                  min={currentYear}
                  placeholder="Year"
                  type="number"
                  value={paymentCardForm.expiryYear}
                  onChange={(event) => onPaymentCardFormChange({ ...paymentCardForm, expiryYear: event.target.value })}
                  required
                />
                <input
                  inputMode="numeric"
                  pattern={cvvPattern}
                  placeholder="CVV"
                  value={paymentCardForm.cvv}
                  onChange={(event) => onPaymentCardFormChange({ ...paymentCardForm, cvv: event.target.value })}
                  required
                />
                <button className="primary" disabled={submitting} type="submit">
                  Save card
                </button>
                <button className="link-button" disabled={submitting} onClick={onCancelPaymentCardForm} type="button">
                  Cancel
                </button>
              </form>
            ) : (
              <button
                className="small-primary-button"
                disabled={submitting}
                onClick={() => onShowPaymentCardForm(true)}
                type="button"
              >
                Add card
              </button>
            )}
          </section>
        </div>

        <div className="profile-booking-stack">
          <section className="panel profile-bookings">
            <div className="section-title">
              <h3>Hotel bookings</h3>
              {bookingsLoading && <span>Loading</span>}
            </div>

            <div className="booking-history">
              {bookings.map((profileBooking) => (
                <article className="history-card" key={profileBooking.id}>
                  <div>
                    <p className="eyebrow">Booking #{profileBooking.id}</p>
                    <h3>{profileBooking.hotelName}</h3>
                    <p>
                      {profileBooking.roomType} / {profileBooking.checkInDate} - {profileBooking.checkOutDate}
                    </p>
                    <small>
                      Customer: {profileBooking.customerName} / {formatMoney(profileBooking.totalPrice)}
                    </small>
                    {profileBooking.savedCardLast4 && <small>Saved card: **** {profileBooking.savedCardLast4}</small>}
                  </div>

                  <div className="history-actions">
                    <span className={`status-pill ${profileBooking.status.toLowerCase()}`}>
                      {formatProfilePaymentStatus(profileBooking.status)}
                    </span>
                  </div>
                </article>
              ))}

              {!bookingsLoading && bookings.length === 0 && <p className="empty">No bookings yet.</p>}
            </div>
          </section>

          <section className="panel profile-bookings">
            <div className="section-title">
              <h3>Taxi bookings</h3>
              {taxiBookingsLoading && <span>Loading</span>}
            </div>

            <div className="booking-history">
              {taxiBookings.map((profileTaxiBooking) => (
                <article className="history-card" key={profileTaxiBooking.id}>
                  <div>
                    <p className="eyebrow">Taxi booking #{profileTaxiBooking.id}</p>
                    <h3>{profileTaxiBooking.taxiServiceName}</h3>
                    <p>
                      {profileTaxiBooking.pickupAddress} to {profileTaxiBooking.dropoffAddress}
                    </p>
                    <small>
                      {formatTaxiCarClassName(profileTaxiBooking.carClassName)} / {profileTaxiBooking.distanceKm.toFixed(2)} km / {formatMoney(profileTaxiBooking.totalPrice)}
                    </small>
                    {profileTaxiBooking.savedCardLast4 && <small>Saved card: **** {profileTaxiBooking.savedCardLast4}</small>}
                  </div>

                  <div className="history-actions">
                    <span className={`status-pill ${profileTaxiBooking.status.toLowerCase()}`}>
                      {formatProfilePaymentStatus(profileTaxiBooking.status)}
                    </span>
                  </div>
                </article>
              ))}

              {!taxiBookingsLoading && taxiBookings.length === 0 && <p className="empty">No taxi bookings yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </section>
      </main>
    </div>
  );
}
