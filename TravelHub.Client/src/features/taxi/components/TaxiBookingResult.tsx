import type { ReactNode } from 'react';
import { formatMoney } from '../../../utils/formatting';
import type { TaxiBooking } from '../../../types';

type TaxiBookingResultProps = {
  booking: TaxiBooking | null;
  renderPaymentForm: (booking: TaxiBooking, bookingKind?: 'hotel' | 'taxi') => ReactNode;
  onReset: () => void;
};

export default function TaxiBookingResult({ booking, renderPaymentForm, onReset }: TaxiBookingResultProps) {
  if (!booking) {
    return null;
  }

  return (
    <div className="booking-box taxi-booking-box">
      <div>
        <h3>{booking.status}</h3>
        <p>{booking.pickupAddress} to {booking.dropoffAddress}</p>
        <p>{booking.distanceKm.toFixed(2)} km / {formatMoney(booking.totalPrice)} total</p>
        {booking.savedCardLast4 && <p>Saved card: **** {booking.savedCardLast4}</p>}
      </div>

      {booking.status === 'PendingPayment' && renderPaymentForm(booking, 'taxi')}

      {booking.status !== 'PendingPayment' && (
        <button className="primary" onClick={onReset} type="button">
          New taxi booking
        </button>
      )}
    </div>
  );
}
