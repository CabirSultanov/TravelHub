import type { PaymentForm, PaymentMode, SavedPaymentCard } from '../../types';

type PaymentMethodFieldsProps = {
  paymentMode: PaymentMode;
  paymentForm: PaymentForm;
  savedPaymentCards: SavedPaymentCard[];
  cardNumberPattern: string;
  cvvPattern: string;
  currentYear: number;
  onPaymentModeChange: (mode: PaymentMode) => void;
  onPaymentFormChange: (form: PaymentForm) => void;
};

export default function PaymentMethodFields({
  paymentMode,
  paymentForm,
  savedPaymentCards,
  cardNumberPattern,
  cvvPattern,
  currentYear,
  onPaymentModeChange,
  onPaymentFormChange,
}: PaymentMethodFieldsProps) {
  const canUseSavedCard = savedPaymentCards.length > 0;

  return (
    <>
      <div className="booking-mode">
        <button
          className={paymentMode === 'saved' ? 'active' : ''}
          disabled={!canUseSavedCard}
          onClick={() => canUseSavedCard && onPaymentModeChange('saved')}
          type="button"
        >
          Saved card
        </button>
        <button className={paymentMode === 'new' ? 'active' : ''} onClick={() => onPaymentModeChange('new')} type="button">
          New card
        </button>
      </div>

      {paymentMode === 'saved' && canUseSavedCard ? (
        <select
          className="payment-saved-card"
          onChange={(event) => onPaymentFormChange({ ...paymentForm, savedPaymentCardId: event.target.value })}
          required
          value={paymentForm.savedPaymentCardId}
        >
          {savedPaymentCards.map((card) => <option key={card.id} value={card.id}>{paymentCardLabel(card)}</option>)}
        </select>
      ) : (
        <>
          <input className="payment-card-number" inputMode="numeric" onChange={(event) => onPaymentFormChange({ ...paymentForm, cardNumber: event.target.value })} pattern={cardNumberPattern} placeholder="Card number" required value={paymentForm.cardNumber} />
          <input className="payment-card-holder" onChange={(event) => onPaymentFormChange({ ...paymentForm, cardHolderName: event.target.value })} placeholder="Card holder" required value={paymentForm.cardHolderName} />
          <input className="payment-expiry-month" max="12" min="1" onChange={(event) => onPaymentFormChange({ ...paymentForm, expiryMonth: event.target.value })} placeholder="Month" required type="number" value={paymentForm.expiryMonth} />
          <input className="payment-expiry-year" min={currentYear} onChange={(event) => onPaymentFormChange({ ...paymentForm, expiryYear: event.target.value })} placeholder="Year" required type="number" value={paymentForm.expiryYear} />
          <input className="payment-cvv" inputMode="numeric" onChange={(event) => onPaymentFormChange({ ...paymentForm, cvv: event.target.value })} pattern={cvvPattern} placeholder="CVV" required value={paymentForm.cvv} />
          <label className="checkbox">
            <input checked={paymentForm.saveCard} onChange={(event) => onPaymentFormChange({ ...paymentForm, saveCard: event.target.checked })} type="checkbox" />
            Save card to profile
          </label>
        </>
      )}
    </>
  );
}

function paymentCardLabel(card: SavedPaymentCard) {
  return `${card.brand} **** ${card.last4} / ${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}`;
}
