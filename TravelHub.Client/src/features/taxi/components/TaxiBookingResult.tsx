import { formatMoney } from '../../../utils/formatting';
import type { TaxiBooking } from '../../../types';

type TaxiBookingResultProps = {
  booking: TaxiBooking | null;
  onReset: () => void;
  onCancel: () => void;
};

export default function TaxiBookingResult({ booking, onReset, onCancel }: TaxiBookingResultProps) {
  if (!booking) return null;

  const statusMessage = taxiStatusMessage(booking.status);
  const canCancel = booking.status === 'AwaitingDriver';
  const canBookAgain = booking.status === 'Completed' || booking.status === 'Cancelled';

  return (
    <div className="booking-box taxi-booking-box">
      <div>
        <h3>{statusMessage.title}</h3>
        <p>{statusMessage.message}</p>
        <p>{booking.pickupAddress} to {booking.dropoffAddress}</p>
        <p>{booking.distanceKm.toFixed(2)} km / {formatMoney(booking.totalPrice)} total</p>
        {booking.savedCardLast4 && <p>Payment method: **** {booking.savedCardLast4}</p>}
        {booking.paidAt && <p>Payment completed when the driver accepted the ride.</p>}
      </div>

      {booking.driverName && (
        <div className="taxi-driver-details">
          <strong>Your driver</strong>
          <span>{booking.driverName}</span>
          {booking.driverPhoneNumber && <span>{booking.driverPhoneNumber}</span>}
        </div>
      )}

      {canCancel && <button className="secondary" onClick={onCancel} type="button">Cancel ride request</button>}
      {canBookAgain && <button className="primary" onClick={onReset} type="button">New taxi booking</button>}
    </div>
  );
}

function taxiStatusMessage(status: TaxiBooking['status']) {
  switch (status) {
    case 'AwaitingDriver': return { title: 'Finding a driver', message: 'Your request is being shown to drivers from this taxi service.' };
    case 'DriverAssigned': return { title: 'Driver is on the way', message: 'Your driver accepted the ride and payment was completed.' };
    case 'DriverArrived': return { title: 'Driver arrived', message: 'Your driver has arrived at the pickup location.' };
    case 'Completed': return { title: 'Ride completed', message: 'Thank you for travelling with TravelHub.' };
    case 'Cancelled': return { title: 'Ride cancelled', message: 'This taxi request was cancelled.' };
    case 'PendingPayment': return { title: 'Payment method required', message: 'Complete the payment method before finding a driver.' };
    case 'Paid': return { title: 'Payment completed', message: 'This is a legacy taxi booking.' };
  }
}
