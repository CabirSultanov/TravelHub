import type { FormEvent } from 'react';
import type { AuthUser, Booking, BookingGuestMode, HotelRoom } from '../../../types';
import type { BookingForm, HotelBookingFormActions } from '../hotels.types';

type HotelBookingFormProps = {
  selectedRoom: HotelRoom | null;
  booking: Booking | null;
  currentUser: AuthUser | null;
  bookingForm: BookingForm;
  bookingGuestMode: BookingGuestMode;
  phoneNumberPattern: string;
  submitting: boolean;
  actions: HotelBookingFormActions;
  onOpenAuth: () => void;
};

export default function HotelBookingForm({
  selectedRoom,
  booking,
  currentUser,
  bookingForm,
  bookingGuestMode,
  phoneNumberPattern,
  submitting,
  actions,
  onOpenAuth,
}: HotelBookingFormProps) {
  if (!selectedRoom || booking) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="form-grid">
        <h3>{selectedRoom.roomType} booking</h3>
        <p className="empty">Please register or sign in to create a booking.</p>
        <button className="primary" onClick={onOpenAuth} type="button">
          Register to book
        </button>
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={(event: FormEvent<HTMLFormElement>) => void actions.submit(event)}>
      <h3>{selectedRoom.roomType} booking</h3>
      <div className="booking-mode">
        <button
          className={bookingGuestMode === 'self' ? 'active' : ''}
          onClick={() => actions.selectGuestMode('self')}
          type="button"
        >
          Book for myself
        </button>
        <button
          className={bookingGuestMode === 'other' ? 'active' : ''}
          onClick={() => actions.selectGuestMode('other')}
          type="button"
        >
          Book for someone else
        </button>
      </div>
      <input
        placeholder="Customer name"
        value={bookingForm.customerName}
        onChange={(event) => actions.setForm({ ...bookingForm, customerName: event.target.value })}
        required
      />
      <input
        pattern={phoneNumberPattern}
        placeholder="Phone number"
        type="tel"
        value={bookingForm.phoneNumber}
        onChange={(event) => actions.setForm({ ...bookingForm, phoneNumber: event.target.value })}
        required
      />
      <input
        placeholder="Email"
        type="email"
        value={bookingForm.email}
        onChange={(event) => actions.setForm({ ...bookingForm, email: event.target.value })}
        required
      />
      <input
        type="date"
        value={bookingForm.checkInDate}
        onChange={(event) => actions.setForm({ ...bookingForm, checkInDate: event.target.value })}
        required
      />
      <input
        type="date"
        value={bookingForm.checkOutDate}
        onChange={(event) => actions.setForm({ ...bookingForm, checkOutDate: event.target.value })}
        required
      />
      <button className="primary" disabled={submitting} type="submit">
        Create booking
      </button>
    </form>
  );
}
