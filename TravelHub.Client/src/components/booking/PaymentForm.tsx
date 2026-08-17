import type { FormEvent } from 'react';
import type { PaymentForm as PaymentFormState, PaymentMode, SavedPaymentCard } from '../../types';

type PaymentFormProps = {
  paymentMode: PaymentMode;
  paymentForm: PaymentFormState;
  savedPaymentCards: SavedPaymentCard[];
  submitting: boolean;
  cardNumberPattern: string;
  cvvPattern: string;
  currentYear: number;
  onPaymentModeChange: (mode: PaymentMode) => void;
  onPaymentFormChange: (form: PaymentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export default function PaymentForm({
  paymentMode,
  paymentForm,
  savedPaymentCards,
  submitting,
  cardNumberPattern,
  cvvPattern,
  currentYear,
  onPaymentModeChange,
  onPaymentFormChange,
  onSubmit,
  onCancel,
}: PaymentFormProps) {
  const canUseSavedCard = savedPaymentCards.length > 0;

  return (
    <form className="payment-form" onSubmit={onSubmit}>
      <div className="booking-mode">
        <button
          className={paymentMode === 'saved' ? 'active' : ''}
          disabled={!canUseSavedCard}
          onClick={() => {
            if (canUseSavedCard) {
              onPaymentModeChange('saved');
            }
          }}
          type="button"
        >
          Saved card
        </button>
        <button
          className={paymentMode === 'new' ? 'active' : ''}
          onClick={() => onPaymentModeChange('new')}
          type="button"
        >
          New card
        </button>
      </div>

      {paymentMode === 'saved' && canUseSavedCard ? (
        <select
          className="payment-saved-card"
          value={paymentForm.savedPaymentCardId}
          onChange={(event) => onPaymentFormChange({ ...paymentForm, savedPaymentCardId: event.target.value })}
          required
        >
          {savedPaymentCards.map((card) => (
            <option key={card.id} value={card.id}>
              {paymentCardLabel(card)}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            className="payment-card-number"
            inputMode="numeric"
            pattern={cardNumberPattern}
            placeholder="Card number"
            value={paymentForm.cardNumber}
            onChange={(event) => onPaymentFormChange({ ...paymentForm, cardNumber: event.target.value })}
            required
          />
          <input
            className="payment-card-holder"
            placeholder="Card holder"
            value={paymentForm.cardHolderName}
            onChange={(event) => onPaymentFormChange({ ...paymentForm, cardHolderName: event.target.value })}
            required
          />
          <input
            className="payment-expiry-month"
            min="1"
            max="12"
            placeholder="Month"
            type="number"
            value={paymentForm.expiryMonth}
            onChange={(event) => onPaymentFormChange({ ...paymentForm, expiryMonth: event.target.value })}
            required
          />
          <input
            className="payment-expiry-year"
            min={currentYear}
            placeholder="Year"
            type="number"
            value={paymentForm.expiryYear}
            onChange={(event) => onPaymentFormChange({ ...paymentForm, expiryYear: event.target.value })}
            required
          />
          <input
            className="payment-cvv"
            inputMode="numeric"
            pattern={cvvPattern}
            placeholder="CVV"
            value={paymentForm.cvv}
            onChange={(event) => onPaymentFormChange({ ...paymentForm, cvv: event.target.value })}
            required
          />
          <label className="checkbox">
            <input
              checked={paymentForm.saveCard}
              type="checkbox"
              onChange={(event) => onPaymentFormChange({ ...paymentForm, saveCard: event.target.checked })}
            />
            Save card to profile
          </label>
        </>
      )}
      <button className="primary payment-submit-button" disabled={submitting} type="submit">
        {submitting && <span className="button-spinner" aria-hidden="true" />}
        {submitting ? 'Processing...' : 'Pay now'}
      </button>
      <button className="payment-cancel-button" disabled={submitting} onClick={onCancel} type="button">
        Cancel booking
      </button>
    </form>
  );
}

function paymentCardLabel(card: SavedPaymentCard) {
  return `${card.brand} **** ${card.last4} / ${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}`;
}
