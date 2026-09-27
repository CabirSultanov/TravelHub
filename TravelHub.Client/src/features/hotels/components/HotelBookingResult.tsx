import type { ReactNode } from 'react';
import { formatMoney } from '../../../utils/formatting';
import type { Booking } from '../../../types';

type HotelBookingResultProps = {
  booking: Booking | null;
  renderPaymentForm: (booking: Booking) => ReactNode;
  onReset: () => void;
};

export default function HotelBookingResult({ booking, renderPaymentForm, onReset }: HotelBookingResultProps) {
  if (!booking) {
    return null;
  }

  return (
    <div className="booking-box">
      <div>
        <p className="eyebrow">Booking #{booking.id}</p>
        <h3>{booking.status}</h3>
        <p>{formatMoney(booking.totalPrice)} total</p>
        {booking.savedCardLast4 && <p>Saved card: **** {booking.savedCardLast4}</p>}
      </div>

      {booking.status === 'PendingPayment' && renderPaymentForm(booking)}

      {booking.status !== 'PendingPayment' && (
        <button className="primary" onClick={onReset} type="button">
          New booking
        </button>
      )}
    </div>
  );
}
