import type { FormEvent } from 'react';
import type { PaymentForm as PaymentFormState, PaymentMode, SavedPaymentCard } from '../../types';
import PaymentMethodFields from './PaymentMethodFields';

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
  return (
    <form className="payment-form" onSubmit={onSubmit}>
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
